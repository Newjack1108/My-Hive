import express from 'express';
import { pool } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import {
    CreateHoneyHarvestSchema,
    UpdateHoneyHarvestSchema,
    CreateHoneyStorageSchema,
    UpdateHoneyStorageSchema,
    CreateHoneyBatchSchema
} from '@my-hive/shared';
import { logActivity } from '../utils/activity.js';

export const honeyRouter = express.Router();

honeyRouter.use(authenticateToken);

// Harvests
honeyRouter.get('/harvests', async (req: AuthRequest, res, next) => {
    try {
        const hiveId = req.query.hive_id as string | undefined;
        const startDate = req.query.start_date as string | undefined;
        const endDate = req.query.end_date as string | undefined;

        let query = `
            SELECT hh.*, h.label as hive_label, h.public_id as hive_public_id
            FROM honey_harvests hh
            JOIN hives h ON hh.hive_id = h.id
            WHERE hh.org_id = $1
        `;
        const params: any[] = [req.user!.org_id];

        if (hiveId) {
            query += ' AND hh.hive_id = $2';
            params.push(hiveId);
        }

        if (startDate) {
            query += ` AND hh.harvest_date >= $${params.length + 1}`;
            params.push(startDate);
        }

        if (endDate) {
            query += ` AND hh.harvest_date <= $${params.length + 1}`;
            params.push(endDate);
        }

        query += ' ORDER BY hh.harvest_date DESC';

        const result = await pool.query(query, params);
        res.json({ harvests: result.rows });
    } catch (error) {
        next(error);
    }
});

honeyRouter.get('/harvests/:id', async (req: AuthRequest, res, next) => {
    try {
        const result = await pool.query(
            `SELECT hh.*, h.label as hive_label, h.public_id as hive_public_id
             FROM honey_harvests hh
             JOIN hives h ON hh.hive_id = h.id
             WHERE hh.id = $1 AND hh.org_id = $2`,
            [req.params.id, req.user!.org_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Harvest not found' });
        }

        res.json({ harvest: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

honeyRouter.post('/harvests', async (req: AuthRequest, res, next) => {
    try {
        const data = CreateHoneyHarvestSchema.parse(req.body);

        const result = await pool.query(
            `INSERT INTO honey_harvests (org_id, hive_id, harvest_date, weight_kg, frames, notes)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [
                req.user!.org_id,
                data.hive_id,
                data.harvest_date,
                data.weight_kg,
                data.frames || null,
                data.notes || null
            ]
        );

        const harvest = result.rows[0];

        await logActivity(
            req.user!.org_id,
            req.user!.id,
            'create_honey_harvest',
            'honey_harvest',
            harvest.id,
            { weight_kg: harvest.weight_kg, hive_id: harvest.hive_id }
        );

        res.status(201).json({ harvest });
    } catch (error) {
        next(error);
    }
});

honeyRouter.patch('/harvests/:id', async (req: AuthRequest, res, next) => {
    try {
        const data = UpdateHoneyHarvestSchema.parse(req.body);

        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (data.hive_id !== undefined) {
            updates.push(`hive_id = $${paramIndex++}`);
            values.push(data.hive_id);
        }
        if (data.harvest_date !== undefined) {
            updates.push(`harvest_date = $${paramIndex++}`);
            values.push(data.harvest_date);
        }
        if (data.weight_kg !== undefined) {
            updates.push(`weight_kg = $${paramIndex++}`);
            values.push(data.weight_kg);
        }
        if (data.frames !== undefined) {
            updates.push(`frames = $${paramIndex++}`);
            values.push(data.frames || null);
        }
        if (data.notes !== undefined) {
            updates.push(`notes = $${paramIndex++}`);
            values.push(data.notes || null);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        values.push(req.params.id, req.user!.org_id);

        const result = await pool.query(
            `UPDATE honey_harvests SET ${updates.join(', ')}
             WHERE id = $${paramIndex++} AND org_id = $${paramIndex++}
             RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Harvest not found' });
        }

        res.json({ harvest: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

// Storage
honeyRouter.get('/storage', async (req: AuthRequest, res, next) => {
    try {
        const result = await pool.query(
            `SELECT * FROM honey_storage
             WHERE org_id = $1
             ORDER BY location_name`,
            [req.user!.org_id]
        );

        res.json({ storage: result.rows });
    } catch (error) {
        next(error);
    }
});

honeyRouter.post('/storage', async (req: AuthRequest, res, next) => {
    try {
        const data = CreateHoneyStorageSchema.parse(req.body);

        const result = await pool.query(
            `INSERT INTO honey_storage (org_id, location_name, location_type, capacity_kg, current_quantity_kg, notes)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [
                req.user!.org_id,
                data.location_name,
                data.location_type || null,
                data.capacity_kg || null,
                data.current_quantity_kg || 0,
                data.notes || null
            ]
        );

        res.status(201).json({ storage: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

honeyRouter.patch('/storage/:id', async (req: AuthRequest, res, next) => {
    try {
        const data = UpdateHoneyStorageSchema.parse(req.body);

        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (data.location_name !== undefined) {
            updates.push(`location_name = $${paramIndex++}`);
            values.push(data.location_name);
        }
        if (data.location_type !== undefined) {
            updates.push(`location_type = $${paramIndex++}`);
            values.push(data.location_type || null);
        }
        if (data.capacity_kg !== undefined) {
            updates.push(`capacity_kg = $${paramIndex++}`);
            values.push(data.capacity_kg || null);
        }
        if (data.current_quantity_kg !== undefined) {
            updates.push(`current_quantity_kg = $${paramIndex++}`);
            values.push(data.current_quantity_kg);
        }
        if (data.notes !== undefined) {
            updates.push(`notes = $${paramIndex++}`);
            values.push(data.notes || null);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        values.push(req.params.id, req.user!.org_id);

        const result = await pool.query(
            `UPDATE honey_storage SET ${updates.join(', ')}
             WHERE id = $${paramIndex++} AND org_id = $${paramIndex++}
             RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Storage location not found' });
        }

        res.json({ storage: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

// Batches
honeyRouter.get('/batches', async (req: AuthRequest, res, next) => {
    try {
        const result = await pool.query(
            `SELECT hb.*, hh.hive_id, h.label as hive_label, hs.location_name as storage_location_name
             FROM honey_batches hb
             LEFT JOIN honey_harvests hh ON hb.harvest_id = hh.id
             LEFT JOIN hives h ON hh.hive_id = h.id
             LEFT JOIN honey_storage hs ON hb.storage_location_id = hs.id
             WHERE hb.org_id = $1
             ORDER BY hb.batch_number`,
            [req.user!.org_id]
        );

        // Parse JSONB fields
        const batches = result.rows.map(batch => ({
            ...batch,
            quality_metrics: batch.quality_metrics ? (typeof batch.quality_metrics === 'string' ? JSON.parse(batch.quality_metrics) : batch.quality_metrics) : null
        }));

        res.json({ batches });
    } catch (error) {
        next(error);
    }
});

honeyRouter.post('/batches', async (req: AuthRequest, res, next) => {
    try {
        const data = CreateHoneyBatchSchema.parse(req.body);

        const result = await pool.query(
            `INSERT INTO honey_batches (org_id, harvest_id, batch_number, processing_date, weight_kg, quality_metrics, storage_location_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [
                req.user!.org_id,
                data.harvest_id || null,
                data.batch_number,
                data.processing_date || null,
                data.weight_kg || null,
                data.quality_metrics ? JSON.stringify(data.quality_metrics) : null,
                data.storage_location_id || null
            ]
        );

        const batch = result.rows[0];
        if (batch.quality_metrics) {
            batch.quality_metrics = JSON.parse(batch.quality_metrics);
        }

        res.status(201).json({ batch });
    } catch (error) {
        next(error);
    }
});

// Statistics
honeyRouter.get('/stats', async (req: AuthRequest, res, next) => {
    try {
        const startDate = req.query.start_date as string | undefined;
        const endDate = req.query.end_date as string | undefined;
        const hiveId = req.query.hive_id as string | undefined;

        let whereClause = 'WHERE hh.org_id = $1';
        const params: any[] = [req.user!.org_id];

        if (startDate) {
            whereClause += ` AND hh.harvest_date >= $${params.length + 1}`;
            params.push(startDate);
        }

        if (endDate) {
            whereClause += ` AND hh.harvest_date <= $${params.length + 1}`;
            params.push(endDate);
        }

        if (hiveId) {
            whereClause += ` AND hh.hive_id = $${params.length + 1}`;
            params.push(hiveId);
        }

        // Total yield
        const totalResult = await pool.query(
            `SELECT COALESCE(SUM(weight_kg), 0) as total_kg, COUNT(*) as harvest_count
             FROM honey_harvests hh
             ${whereClause}`,
            params
        );

        // By hive
        const byHiveResult = await pool.query(
            `SELECT h.id, h.label, h.public_id,
                    COALESCE(SUM(hh.weight_kg), 0) as total_kg,
                    COUNT(hh.id) as harvest_count
             FROM hives h
             LEFT JOIN honey_harvests hh ON h.id = hh.hive_id AND hh.org_id = $1
             ${hiveId ? 'WHERE h.id = $2' : 'WHERE h.org_id = $1'}
             GROUP BY h.id, h.label, h.public_id
             HAVING COUNT(hh.id) > 0
             ORDER BY total_kg DESC`,
            hiveId ? [req.user!.org_id, hiveId] : [req.user!.org_id]
        );

        // By month
        const byMonthResult = await pool.query(
            `SELECT 
                DATE_TRUNC('month', harvest_date) as month,
                SUM(weight_kg) as total_kg,
                COUNT(*) as harvest_count
             FROM honey_harvests hh
             ${whereClause}
             GROUP BY DATE_TRUNC('month', harvest_date)
             ORDER BY month DESC
             LIMIT 12`,
            params
        );

        const totalRow = totalResult.rows[0] || { total_kg: 0, harvest_count: 0 };
        res.json({
            total: {
                total_kg: parseFloat(totalRow.total_kg) || 0,
                harvest_count: parseInt(totalRow.harvest_count) || 0
            },
            by_hive: byHiveResult.rows.map(row => ({
                ...row,
                total_kg: parseFloat(row.total_kg) || 0,
                harvest_count: parseInt(row.harvest_count) || 0
            })),
            by_month: byMonthResult.rows.map(row => ({
                ...row,
                total_kg: parseFloat(row.total_kg) || 0,
                harvest_count: parseInt(row.harvest_count) || 0
            }))
        });
    } catch (error) {
        next(error);
    }
});
