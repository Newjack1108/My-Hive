#!/usr/bin/env node
/**
 * Standalone database migration script
 * Can be run directly: node migrate-db.js
 * Or via npm: npm run db:migrate
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import and run the migration script
const migrateScript = join(__dirname, 'packages/db/migrate.js');

console.log('Running database migrations...');
console.log('Migration script:', migrateScript);

try {
    // Dynamically import and execute the migration
    await import(migrateScript);
    console.log('✓ Migrations completed');
    process.exit(0);
} catch (error) {
    console.error('✗ Migration failed:', error);
    process.exit(1);
}
