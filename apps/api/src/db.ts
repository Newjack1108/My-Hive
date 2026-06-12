import pg from 'pg';
import { getDbSslConfig } from '../../../packages/db/sslConfig.js';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/myhive';

export const pool = new Pool({
    connectionString: DATABASE_URL,
    max: 5,
    min: 0,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
    ssl: getDbSslConfig(DATABASE_URL),
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});

pool.on('connect', () => {
    console.log('Database connection established');
});
