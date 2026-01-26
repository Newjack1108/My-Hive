import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/myhive';

async function connectWithRetry(client, maxRetries = 3, delay = 2000) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            await client.connect();
            console.log('Connected to database');
            return true;
        } catch (error: any) {
            if (i < maxRetries - 1) {
                console.log(`Connection attempt ${i + 1} failed, retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                throw error;
            }
        }
    }
    return false;
}

async function migrate() {
    const client = new Client({
        connectionString: DATABASE_URL,
        connectionTimeoutMillis: 10000, // 10 second timeout
    });

    try {
        await connectWithRetry(client, 3, 2000);

        // Create migrations tracking table
        await client.query(`
            CREATE TABLE IF NOT EXISTS migrations (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) UNIQUE NOT NULL,
                applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `);

        // Get list of migration files
        const { readdirSync } = await import('fs');
        const migrationsDir = join(__dirname, 'migrations');
        const files = readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort();

        console.log(`Found ${files.length} migration files`);

        // Check which migrations have been applied
        const result = await client.query('SELECT filename FROM migrations');
        const applied = new Set(result.rows.map(r => r.filename));

        // Apply pending migrations
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
    } catch (error: any) {
        console.error('Migration failed:', error.message || error);
        // Don't exit with error code - allow server to start even if migrations fail
        // Migrations can be run manually later
        console.warn('Continuing despite migration failure. Server will start but migrations may need to be run manually.');
    } finally {
        try {
            await client.end();
        } catch (e) {
            // Ignore errors closing connection
        }
    }
}

migrate();
