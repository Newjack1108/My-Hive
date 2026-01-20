import express from 'express';
import { pool } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { CreateInspectionSchema, UpdateInspectionSchema } from '@my-hive/shared';
import { logActivity } from '../utils/activity.js';
import { v4 as uuidv4 } from 'uuid';

export const inspectionsRouter = express.Router();

inspectionsRouter.use(authenticateToken);

// List inspections
inspectionsRouter.get('/', async (req: AuthRequest, res, next) => {
    try {
        const { hive_id, limit = '50' } = req.query;

        let query = `
            SELECT i.*, h.label as hive_label, h.public_id as hive_public_id,
                   u.name as inspector_name
            FROM inspections i
            JOIN hives h ON i.hive_id = h.id
            JOIN users u ON i.inspector_user_id = u.id
            WHERE i.org_id = $1
        `;
        const params: any[] = [req.user!.org_id];

        if (hive_id) {
            query += ' AND i.hive_id = $2';
            params.push(hive_id);
        }

        query += ' ORDER BY i.started_at DESC LIMIT $' + (params.length + 1);
        params.push(parseInt(limit as string));

        const result = await pool.query(query, params);

        res.json({ inspections: result.rows });
    } catch (error) {
        next(error);
    }
});

// Get inspection by ID
inspectionsRouter.get('/:id', async (req: AuthRequest, res, next) => {
    try {
        const result = await pool.query(
            `SELECT i.*, h.label as hive_label, h.public_id as hive_public_id,
                    u.name as inspector_name
             FROM inspections i
             JOIN hives h ON i.hive_id = h.id
             JOIN users u ON i.inspector_user_id = u.id
             WHERE i.id = $1 AND i.org_id = $2`,
            [req.params.id, req.user!.org_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Inspection not found' });
        }

        // Get photos
        const photosResult = await pool.query(
            `SELECT id, storage_key, thumbnail_storage_key, width, height, bytes, mime_type, created_at
             FROM inspection_photos
             WHERE inspection_id = $1
             ORDER BY created_at`,
            [req.params.id]
        );

        // Get treatments
        const treatmentsResult = await pool.query(
            `SELECT * FROM treatments WHERE inspection_id = $1`,
            [req.params.id]
        );

        res.json({
            inspection: result.rows[0],
            photos: photosResult.rows,
            treatments: treatmentsResult.rows,
        });
    } catch (error) {
        next(error);
    }
});

// Create inspection (with deduplication by client_uuid)
inspectionsRouter.post('/', async (req: AuthRequest, res, next) => {
    try {
        if (!['admin', 'manager', 'inspector'].includes(req.user!.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const data = CreateInspectionSchema.parse(req.body);

        // Check for duplicate by client_uuid
        if (data.client_uuid) {
            const existing = await pool.query(
                'SELECT id FROM inspections WHERE client_uuid = $1',
                [data.client_uuid]
            );

            if (existing.rows.length > 0) {
                // Return existing inspection
                const existingResult = await pool.query(
                    `SELECT i.*, h.label as hive_label
                     FROM inspections i
                     JOIN hives h ON i.hive_id = h.id
                     WHERE i.id = $1`,
                    [existing.rows[0].id]
                );

                return res.json({
                    inspection: existingResult.rows[0],
                    duplicate: true,
                });
            }
        }

        const result = await pool.query(
            `INSERT INTO inspections (
                org_id, hive_id, inspector_user_id, started_at, ended_at,
                location_lat, location_lng, location_accuracy_m,
                offline_created_at, client_uuid, sections_json, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *`,
            [
                req.user!.org_id,
                data.hive_id,
                req.user!.id,
                data.started_at,
                data.ended_at || null,
                data.location_lat || null,
                data.location_lng || null,
                data.location_accuracy_m || null,
                data.offline_created_at || null,
                data.client_uuid,
                data.sections_json ? JSON.stringify(data.sections_json) : null,
                data.notes || null,
            ]
        );

        const inspection = result.rows[0];

        // Lock inspection if it has ended_at (completed)
        if (data.ended_at) {
            await pool.query(
                'UPDATE inspections SET locked_at = NOW() WHERE id = $1',
                [inspection.id]
            );
            inspection.locked_at = new Date().toISOString();
        }

        await logActivity(
            req.user!.org_id,
            req.user!.id,
            'create_inspection',
            'inspection',
            inspection.id,
            { hive_id: data.hive_id, client_uuid: data.client_uuid }
        );

        res.status(201).json({ inspection });
    } catch (error) {
        next(error);
    }
});

// Update inspection (only if not locked)
inspectionsRouter.patch('/:id', async (req: AuthRequest, res, next) => {
    try {
        if (!['admin', 'manager', 'inspector'].includes(req.user!.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        // Check if inspection is locked
        const checkResult = await pool.query(
            'SELECT locked_at FROM inspections WHERE id = $1 AND org_id = $2',
            [req.params.id, req.user!.org_id]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Inspection not found' });
        }

        if (checkResult.rows[0].locked_at) {
            return res.status(403).json({ error: 'Inspection is locked and cannot be modified' });
        }

        const data = UpdateInspectionSchema.parse(req.body);

        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (data.ended_at !== undefined) {
            updates.push(`ended_at = $${paramIndex++}`);
            values.push(data.ended_at || null);
            // Lock inspection when ended
            if (data.ended_at) {
                updates.push(`locked_at = NOW()`);
            }
        }
        if (data.sections_json !== undefined) {
            updates.push(`sections_json = $${paramIndex++}`);
            values.push(data.sections_json ? JSON.stringify(data.sections_json) : null);
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
            `UPDATE inspections SET ${updates.join(', ')}
             WHERE id = $${paramIndex++} AND org_id = $${paramIndex++}
             RETURNING *`,
            values
        );

        await logActivity(
            req.user!.org_id,
            req.user!.id,
            'update_inspection',
            'inspection',
            req.params.id,
            data
        );

        res.json({ inspection: result.rows[0] });
    } catch (error) {
        next(error);
    }
});
