import express from 'express';
import { pool } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { CreateApiarySchema, UpdateApiarySchema, UpdateApiaryWithRadiusSchema } from '@my-hive/shared';
import { logActivity } from '../utils/activity.js';

export const apiariesRouter = express.Router();

apiariesRouter.use(authenticateToken);

// List apiaries
apiariesRouter.get('/', async (req: AuthRequest, res, next) => {
    try {
        const result = await pool.query(
            `SELECT id, name, description, lat, lng, feeding_radius_m, created_at
             FROM apiaries WHERE org_id = $1
             ORDER BY name`,
            [req.user!.org_id]
        );

        res.json({ apiaries: result.rows });
    } catch (error) {
        next(error);
    }
});

// Get apiary by ID
apiariesRouter.get('/:id', async (req: AuthRequest, res, next) => {
    try {
        const result = await pool.query(
            `SELECT id, name, description, lat, lng, feeding_radius_m, created_at
             FROM apiaries WHERE id = $1 AND org_id = $2`,
            [req.params.id, req.user!.org_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Apiary not found' });
        }

        res.json({ apiary: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

// Create apiary (admin/manager only)
apiariesRouter.post('/', async (req: AuthRequest, res, next) => {
    try {
        if (!['admin', 'manager'].includes(req.user!.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const data = CreateApiarySchema.parse(req.body);

        const result = await pool.query(
            `INSERT INTO apiaries (org_id, name, description, lat, lng)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, name, description, lat, lng, created_at`,
            [req.user!.org_id, data.name, data.description || null, data.lat || null, data.lng || null]
        );

        const apiary = result.rows[0];

        await logActivity(
            req.user!.org_id,
            req.user!.id,
            'create_apiary',
            'apiary',
            apiary.id,
            { name: apiary.name }
        );

        res.status(201).json({ apiary });
    } catch (error) {
        next(error);
    }
});

// Update apiary
apiariesRouter.patch('/:id', async (req: AuthRequest, res, next) => {
    try {
        if (!['admin', 'manager'].includes(req.user!.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const data = UpdateApiarySchema.parse(req.body);
        const radiusData = UpdateApiaryWithRadiusSchema.safeParse(req.body);

        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (data.name !== undefined) {
            updates.push(`name = $${paramIndex++}`);
            values.push(data.name);
        }
        if (data.description !== undefined) {
            updates.push(`description = $${paramIndex++}`);
            values.push(data.description || null);
        }
        if (data.lat !== undefined) {
            updates.push(`lat = $${paramIndex++}`);
            values.push(data.lat || null);
        }
        if (data.lng !== undefined) {
            updates.push(`lng = $${paramIndex++}`);
            values.push(data.lng || null);
        }
        if (radiusData.success && radiusData.data.feeding_radius_m !== undefined) {
            updates.push(`feeding_radius_m = $${paramIndex++}`);
            values.push(radiusData.data.feeding_radius_m || null);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        values.push(req.params.id, req.user!.org_id);

        const result = await pool.query(
            `UPDATE apiaries SET ${updates.join(', ')}
             WHERE id = $${paramIndex++} AND org_id = $${paramIndex++}
             RETURNING id, name, description, lat, lng, feeding_radius_m, created_at`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Apiary not found' });
        }

        await logActivity(
            req.user!.org_id,
            req.user!.id,
            'update_apiary',
            'apiary',
            req.params.id,
            data
        );

        res.json({ apiary: result.rows[0] });
    } catch (error) {
        next(error);
    }
});
