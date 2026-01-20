import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/myhive';

async function migrate() {
    const client = new Client({
        connectionString: DATABASE_URL,
    });

    try {
        await client.connect();
        console.log('Connected to database');

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
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

migrate();
