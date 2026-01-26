import pg from 'pg';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/myhive';

export const pool = new Pool({
    connectionString: DATABASE_URL,
    max: 5, // Reduced for Railway free tier (typically 5-10 max connections)
    min: 0, // Don't maintain idle connections
    idleTimeoutMillis: 10000, // Close idle connections faster
    connectionTimeoutMillis: 10000, // 10 seconds for Railway
    ssl: process.env.DATABASE_URL?.includes('railway') ? { rejectUnauthorized: false } : undefined,
    // Prevent connection pool exhaustion
    allowExitOnIdle: true,
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    // Don't crash the app on pool errors
});

pool.on('connect', () => {
    console.log('Database connection established');
});

pool.on('remove', () => {
    console.log('Database connection removed from pool');
});
