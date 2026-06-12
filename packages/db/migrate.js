import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getDbSslConfig } from './sslConfig.js';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/myhive';
const isProduction = process.env.NODE_ENV === 'production';

function createClient() {
    return new Client({
        connectionString: DATABASE_URL,
        connectionTimeoutMillis: 10000,
        ssl: getDbSslConfig(DATABASE_URL),
    });
}

async function connectWithRetry(maxRetries = 3, delay = 2000) {
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
        const client = createClient();
        try {
            await client.connect();
            console.log('Connected to database');
            return client;
        } catch (error) {
            lastError = error;
            try {
                await client.end();
            } catch {
                // ignore cleanup errors
            }
            if (i < maxRetries - 1) {
                console.log(`Connection attempt ${i + 1} failed, retrying in ${delay}ms...`, error?.message);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError;
}

async function migrate() {
    let client;

    try {
        client = await connectWithRetry(3, 2000);

        await client.query(`
            CREATE TABLE IF NOT EXISTS migrations (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) UNIQUE NOT NULL,
                applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `);

        const { readdirSync } = await import('fs');
        const migrationsDir = join(__dirname, 'migrations');
        const files = readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort();

        console.log(`Found ${files.length} migration files`);

        const result = await client.query('SELECT filename FROM migrations');
        const applied = new Set(result.rows.map(r => r.filename));

        for (const file of files) {
            if (applied.has(file)) {
                console.log(`Skipping ${file} (already applied)`);
                continue;
            }

            console.log(`Applying migration: ${file}`);
            const sql = readFileSync(join(migrationsDir, file), 'utf-8');

            await client.query('BEGIN');
            try {
                await client.query(sql);
                await client.query('INSERT INTO migrations (filename) VALUES ($1)', [file]);
                await client.query('COMMIT');
                console.log(`✓ Applied ${file}`);
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            }
        }

        console.log('Migrations completed successfully');
        process.exit(0);
    } catch (error) {
        const errorMessage = error?.message || error?.toString() || 'Unknown error';
        console.error('Migration failed:', errorMessage);
        if (isProduction) {
            console.error('Migration failed in production — exiting so deploy fails visibly.');
            process.exit(1);
        }
        console.warn('Continuing despite migration failure. Migrations may need to be run manually.');
        process.exit(0);
    } finally {
        if (client) {
            try {
                await client.end();
            } catch {
                // ignore
            }
        }
    }
}

migrate().catch((error) => {
    console.error('Migration script error:', error?.message || error);
    if (isProduction) {
        process.exit(1);
    }
    process.exit(0);
});
