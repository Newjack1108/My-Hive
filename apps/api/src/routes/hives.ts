import express from 'express';
import { pool } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { CreateHiveSchema, UpdateHiveSchema } from '@my-hive/shared';
import { logActivity } from '../utils/activity.js';

export const hivesRouter = express.Router();

// Get hive by public_id (for NFC deep-linking, auth optional)
hivesRouter.get('/public/:publicId', async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            // Not authenticated - return minimal response
            const result = await pool.query(
                'SELECT id, public_id, label, status FROM hives WHERE public_id = $1',
                [req.params.publicId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Hive not found' });
            }

            return res.json({
                requiresAuth: true,
                message: 'Private hive – please log in',
            });
        }

        // Authenticated - verify and return full data
        const jwt = await import('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
        const decoded = jwt.default.verify(token, JWT_SECRET) as { userId: string; orgId: string };

        const result = await pool.query(
            `SELECT h.*, a.name as apiary_name
             FROM hives h
             LEFT JOIN apiaries a ON h.apiary_id = a.id
             WHERE h.public_id = $1 AND h.org_id = $2`,
            [req.params.publicId, decoded.orgId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Hive not found' });
        }

        res.json({ hive: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

hivesRouter.use(authenticateToken);

// List hives
hivesRouter.get('/', async (req: AuthRequest, res, next) => {
    try {
        const { apiary_id } = req.query;

        let query = `
            SELECT h.*, a.name as apiary_name,
                   (SELECT COUNT(*) FROM inspections WHERE hive_id = h.id) as inspection_count,
                   (SELECT MAX(started_at) FROM inspections WHERE hive_id = h.id) as last_inspection_at
            FROM hives h
            LEFT JOIN apiaries a ON h.apiary_id = a.id
            WHERE h.org_id = $1
        `;
        const params: any[] = [req.user!.org_id];

        if (apiary_id) {
            query += ' AND h.apiary_id = $2';
            params.push(apiary_id);
        }

        query += ' ORDER BY h.label';

        const result = await pool.query(query, params);

        res.json({ hives: result.rows });
    } catch (error) {
        next(error);
    }
});

// Get hive by ID
hivesRouter.get('/:id', async (req: AuthRequest, res, next) => {
    try {
        const result = await pool.query(
            `SELECT h.*, a.name as apiary_name, a.lat as apiary_lat, a.lng as apiary_lng
             FROM hives h
             LEFT JOIN apiaries a ON h.apiary_id = a.id
             WHERE h.id = $1 AND h.org_id = $2`,
            [req.params.id, req.user!.org_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Hive not found' });
        }

        // Get recent inspections
        const inspectionsResult = await pool.query(
            `SELECT id, started_at, ended_at, inspector_user_id, notes
             FROM inspections
             WHERE hive_id = $1
             ORDER BY started_at DESC
             LIMIT 10`,
            [req.params.id]
        );

        // Get pending tasks
        const tasksResult = await pool.query(
            `SELECT id, type, title, due_date, status
             FROM tasks
             WHERE hive_id = $1 AND status IN ('pending', 'in_progress')
             ORDER BY due_date ASC`,
            [req.params.id]
        );

        res.json({
            hive: result.rows[0],
            inspections: inspectionsResult.rows,
            tasks: tasksResult.rows,
        });
    } catch (error) {
        next(error);
    }
});

// Create hive (admin/manager only)
hivesRouter.post('/', async (req: AuthRequest, res, next) => {
    try {
        if (!['admin', 'manager'].includes(req.user!.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const data = CreateHiveSchema.parse(req.body);

        // Check if public_id is unique
        const existing = await pool.query('SELECT id FROM hives WHERE public_id = $1', [data.public_id]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Public ID already exists' });
        }

        const result = await pool.query(
            `INSERT INTO hives (org_id, apiary_id, public_id, label, status)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, org_id, apiary_id, public_id, label, status, created_at`,
            [
                req.user!.org_id,
                data.apiary_id || null,
                data.public_id,
                data.label,
                data.status || 'active',
            ]
        );

        const hive = result.rows[0];

        await logActivity(
            req.user!.org_id,
            req.user!.id,
            'create_hive',
            'hive',
            hive.id,
            { public_id: hive.public_id, label: hive.label }
        );

        res.status(201).json({ hive });
    } catch (error) {
        next(error);
    }
});

// Update hive
hivesRouter.patch('/:id', async (req: AuthRequest, res, next) => {
    try {
        if (!['admin', 'manager'].includes(req.user!.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const data = UpdateHiveSchema.parse(req.body);

        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (data.label !== undefined) {
            updates.push(`label = $${paramIndex++}`);
            values.push(data.label);
        }
        if (data.status !== undefined) {
            updates.push(`status = $${paramIndex++}`);
            values.push(data.status);
        }
        if (data.apiary_id !== undefined) {
            updates.push(`apiary_id = $${paramIndex++}`);
            values.push(data.apiary_id || null);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        values.push(req.params.id, req.user!.org_id);

        const result = await pool.query(
            `UPDATE hives SET ${updates.join(', ')}
             WHERE id = $${paramIndex++} AND org_id = $${paramIndex++}
             RETURNING id, org_id, apiary_id, public_id, label, status, created_at`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Hive not found' });
        }

        await logActivity(
            req.user!.org_id,
            req.user!.id,
            'update_hive',
            'hive',
            req.params.id,
            data
        );

        res.json({ hive: result.rows[0] });
    } catch (error) {
        next(error);
    }
});
