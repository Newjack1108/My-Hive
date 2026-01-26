import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const migrationsRouter = express.Router();

// Run migrations endpoint (admin only)
migrationsRouter.post('/run', authenticateToken, async (req: AuthRequest, res, next) => {
    try {
        // Only allow admins to run migrations
        if (req.user!.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can run migrations' });
        }

        // Get the path to the migration script
        const projectRoot = join(__dirname, '../../../..');
        const migrateScript = join(projectRoot, 'packages/db/migrate.js');

        console.log('Running migrations from:', migrateScript);

        // Run the migration script
        const { stdout, stderr } = await execAsync(`node "${migrateScript}"`, {
            cwd: projectRoot,
            env: process.env,
            maxBuffer: 1024 * 1024 * 10 // 10MB buffer
        });

        if (stderr && !stderr.includes('Connected to database')) {
            console.warn('Migration warnings:', stderr);
        }

        res.json({
            success: true,
            message: 'Migrations completed successfully',
            output: stdout,
            warnings: stderr || null
        });
    } catch (error: any) {
        console.error('Migration error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Migration failed',
            output: error.stdout || '',
            stderr: error.stderr || ''
        });
    }
});

// Get migration status (admin only)
migrationsRouter.get('/status', authenticateToken, async (req: AuthRequest, res, next) => {
    try {
        if (req.user!.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can view migration status' });
        }

        const { pool } = await import('../db.js');
        
        // Get list of applied migrations
        const result = await pool.query(
            'SELECT filename, applied_at FROM migrations ORDER BY applied_at DESC'
        );

        // Get list of all migration files
        const { readdirSync } = await import('fs');
        const { join: pathJoin } = await import('path');
        const { dirname: pathDirname, fileURLToPath: pathFileURLToPath } = await import('url');
        
        const __filename = pathFileURLToPath(import.meta.url);
        const __dirname = pathDirname(__filename);
        const migrationsDir = pathJoin(__dirname, '../../../..', 'packages/db/migrations');
        
        const allMigrations = readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort();

        const appliedFilenames = new Set(result.rows.map(r => r.filename));
        const pending = allMigrations.filter(f => !appliedFilenames.has(f));

        res.json({
            applied: result.rows,
            pending: pending,
            total: allMigrations.length,
            appliedCount: result.rows.length,
            pendingCount: pending.length
        });
    } catch (error: any) {
        console.error('Error getting migration status:', error);
        next(error);
    }
});
