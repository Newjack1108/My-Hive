import express from 'express';
import { pool } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import {
    CreateQueenRecordSchema,
    UpdateQueenRecordSchema,
    CreateBreedingPlanSchema,
    UpdateBreedingPlanSchema,
    CreateQueenLineageSchema,
    CreateBreedingMatchSchema,
    CreateQueenGraftingSessionSchema,
    UpdateQueenGraftingSessionSchema
} from '@my-hive/shared';
import { logActivity } from '../utils/activity.js';

export const queensRouter = express.Router();

queensRouter.use(authenticateToken);

// List queen records
queensRouter.get('/', async (req: AuthRequest, res, next) => {
    try {
        const hiveId = req.query.hive_id as string | undefined;

        let query = `
            SELECT qr.id, qr.hive_id, qr.name, qr.lineage, qr.birth_date, qr.status, qr.notes, qr.created_at,
                   h.label as hive_label
            FROM queen_records qr
            LEFT JOIN hives h ON qr.hive_id = h.id
            WHERE qr.org_id = $1
        `;
        const params: any[] = [req.user!.org_id];

        if (hiveId) {
            query += ' AND qr.hive_id = $2';
            params.push(hiveId);
        }

        query += ' ORDER BY qr.created_at DESC';

        const result = await pool.query(query, params);
        res.json({ queens: result.rows });
    } catch (error) {
        next(error);
    }
});

// List grafting sessions
queensRouter.get('/grafting-sessions', async (req: AuthRequest, res, next) => {
    try {
        const status = req.query.status as string | undefined;
        
        let query = `
            SELECT qgs.*, qr.name as queen_name, h.label as hive_label
            FROM queen_grafting_sessions qgs
            LEFT JOIN queen_records qr ON qgs.queen_id = qr.id
            LEFT JOIN hives h ON qgs.hive_id = h.id
            WHERE qgs.org_id = $1
        `;
        const params: any[] = [req.user!.org_id];

        if (status) {
            query += ' AND qgs.status = $2';
            params.push(status);
        }

        query += ' ORDER BY qgs.grafting_date DESC, qgs.created_at DESC';

        const result = await pool.query(query, params);
        
        // Parse JSONB fields
        const sessions = result.rows.map((row: any) => ({
            ...row,
            checklist_completed: typeof row.checklist_completed === 'string' 
                ? JSON.parse(row.checklist_completed) 
                : row.checklist_completed || {}
        }));

        res.json({ sessions });
    } catch (error: any) {
        // Log detailed error information for debugging
        console.error('Error fetching grafting sessions:', {
            message: error?.message,
            code: error?.code,
            detail: error?.detail,
            hint: error?.hint,
            position: error?.position,
            stack: error?.stack
        });
        next(error);
    }
});

// Get grafting session by ID
queensRouter.get('/grafting-sessions/:id', async (req: AuthRequest, res, next) => {
    try {
        const result = await pool.query(
            `SELECT qgs.*, qr.name as queen_name, h.label as hive_label
             FROM queen_grafting_sessions qgs
             LEFT JOIN queen_records qr ON qgs.queen_id = qr.id
             LEFT JOIN hives h ON qgs.hive_id = h.id
             WHERE qgs.id = $1 AND qgs.org_id = $2`,
            [req.params.id, req.user!.org_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Grafting session not found' });
        }

        const session = result.rows[0];
        session.checklist_completed = typeof session.checklist_completed === 'string'
            ? JSON.parse(session.checklist_completed)
            : session.checklist_completed || {};

        res.json({ session });
    } catch (error) {
        next(error);
    }
});

// Create grafting session
queensRouter.post('/grafting-sessions', async (req: AuthRequest, res, next) => {
    try {
        const data = CreateQueenGraftingSessionSchema.parse(req.body);

        const result = await pool.query(
            `INSERT INTO queen_grafting_sessions (org_id, queen_id, hive_id, name, grafting_date, method, notes, status, checklist_completed)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [
                req.user!.org_id,
                data.queen_id || null,
                data.hive_id || null,
                data.name,
                data.grafting_date,
                data.method || 'standard',
                data.notes || null,
                data.status || 'active',
                JSON.stringify(data.checklist_completed || {})
            ]
        );

        const session = result.rows[0];
        session.checklist_completed = typeof session.checklist_completed === 'string'
            ? JSON.parse(session.checklist_completed)
            : session.checklist_completed || {};

        await logActivity(
            req.user!.org_id,
            req.user!.id,
            'create_grafting_session',
            'grafting_session',
            session.id,
            { name: session.name }
        );

        res.status(201).json({ session });
    } catch (error) {
        next(error);
    }
});

// Update grafting session
queensRouter.patch('/grafting-sessions/:id', async (req: AuthRequest, res, next) => {
    try {
        const data = UpdateQueenGraftingSessionSchema.parse(req.body);

        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (data.queen_id !== undefined) {
            updates.push(`queen_id = $${paramIndex++}`);
            values.push(data.queen_id || null);
        }
        if (data.hive_id !== undefined) {
            updates.push(`hive_id = $${paramIndex++}`);
            values.push(data.hive_id || null);
        }
        if (data.name !== undefined) {
            updates.push(`name = $${paramIndex++}`);
            values.push(data.name);
        }
        if (data.grafting_date !== undefined) {
            updates.push(`grafting_date = $${paramIndex++}`);
            values.push(data.grafting_date);
        }
        if (data.method !== undefined) {
            updates.push(`method = $${paramIndex++}`);
            values.push(data.method);
        }
        if (data.notes !== undefined) {
            updates.push(`notes = $${paramIndex++}`);
            values.push(data.notes || null);
        }
        if (data.status !== undefined) {
            updates.push(`status = $${paramIndex++}`);
            values.push(data.status);
        }
        if (data.checklist_completed !== undefined) {
            updates.push(`checklist_completed = $${paramIndex++}`);
            values.push(JSON.stringify(data.checklist_completed));
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        updates.push(`updated_at = NOW()`);
        values.push(req.params.id, req.user!.org_id);

        const result = await pool.query(
            `UPDATE queen_grafting_sessions SET ${updates.join(', ')}
             WHERE id = $${paramIndex++} AND org_id = $${paramIndex++}
             RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Grafting session not found' });
        }

        const session = result.rows[0];
        session.checklist_completed = typeof session.checklist_completed === 'string'
            ? JSON.parse(session.checklist_completed)
            : session.checklist_completed || {};

        await logActivity(
            req.user!.org_id,
            req.user!.id,
            'update_grafting_session',
            'grafting_session',
            req.params.id,
            data
        );

        res.json({ session });
    } catch (error) {
        next(error);
    }
});

// Delete grafting session
queensRouter.delete('/grafting-sessions/:id', async (req: AuthRequest, res, next) => {
    try {
        const result = await pool.query(
            `DELETE FROM queen_grafting_sessions
             WHERE id = $1 AND org_id = $2
             RETURNING id`,
            [req.params.id, req.user!.org_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Grafting session not found' });
        }

        await logActivity(
            req.user!.org_id,
            req.user!.id,
            'delete_grafting_session',
            'grafting_session',
            req.params.id,
            {}
        );

        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

// Get queen by ID
queensRouter.get('/:id', async (req: AuthRequest, res, next) => {
    try {
        const result = await pool.query(
            `SELECT qr.*, h.label as hive_label
             FROM queen_records qr
             LEFT JOIN hives h ON qr.hive_id = h.id
             WHERE qr.id = $1 AND qr.org_id = $2`,
            [req.params.id, req.user!.org_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Queen record not found' });
        }

        // Get photos
        const photosResult = await pool.query(
            `SELECT id, storage_key, thumbnail_storage_key, width, height, bytes, mime_type, created_at
             FROM queen_photos
             WHERE queen_id = $1 AND org_id = $2
             ORDER BY created_at`,
            [req.params.id, req.user!.org_id]
        );

        const queen = result.rows[0];
        const photos = photosResult.rows.map((photo: any) => ({
            ...photo,
            url: `/api/photos/${photo.id}/image`,
            thumbnail_url: `/api/photos/${photo.id}/thumbnail`,
        }));

        res.json({ queen, photos });
    } catch (error) {
        next(error);
    }
});

// Create queen record
queensRouter.post('/', async (req: AuthRequest, res, next) => {
    try {
        const data = CreateQueenRecordSchema.parse(req.body);

        const result = await pool.query(
            `INSERT INTO queen_records (org_id, hive_id, name, lineage, birth_date, status, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [
                req.user!.org_id,
                data.hive_id || null,
                data.name || null,
                data.lineage || null,
                data.birth_date || null,
                data.status || 'active',
                data.notes || null
            ]
        );

        const queen = result.rows[0];

        await logActivity(
            req.user!.org_id,
            req.user!.id,
            'create_queen_record',
            'queen_record',
            queen.id,
            { name: queen.name }
        );

        res.status(201).json({ queen });
    } catch (error) {
        next(error);
    }
});

// Update queen record
queensRouter.patch('/:id', async (req: AuthRequest, res, next) => {
    try {
        const data = UpdateQueenRecordSchema.parse(req.body);

        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (data.hive_id !== undefined) {
            updates.push(`hive_id = $${paramIndex++}`);
            values.push(data.hive_id || null);
        }
        if (data.name !== undefined) {
            updates.push(`name = $${paramIndex++}`);
            values.push(data.name || null);
        }
        if (data.lineage !== undefined) {
            updates.push(`lineage = $${paramIndex++}`);
            values.push(data.lineage || null);
        }
        if (data.birth_date !== undefined) {
            updates.push(`birth_date = $${paramIndex++}`);
            values.push(data.birth_date || null);
        }
        if (data.status !== undefined) {
            updates.push(`status = $${paramIndex++}`);
            values.push(data.status);
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
            `UPDATE queen_records SET ${updates.join(', ')}
             WHERE id = $${paramIndex++} AND org_id = $${paramIndex++}
             RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Queen record not found' });
        }

        await logActivity(
            req.user!.org_id,
            req.user!.id,
            'update_queen_record',
            'queen_record',
            req.params.id,
            data
        );

        res.json({ queen: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

// Get queen lineage
queensRouter.get('/:id/lineage', async (req: AuthRequest, res, next) => {
    try {
        const result = await pool.query(
            `SELECT ql.*, qr.name as queen_name, qr.birth_date as queen_birth_date,
                    parent.name as parent_queen_name
             FROM queen_lineage ql
             JOIN queen_records qr ON ql.queen_id = qr.id
             LEFT JOIN queen_records parent ON ql.parent_queen_id = parent.id
             WHERE ql.queen_id = $1 AND ql.org_id = $2
             ORDER BY ql.generation`,
            [req.params.id, req.user!.org_id]
        );

        res.json({ lineage: result.rows });
    } catch (error) {
        next(error);
    }
});

// Create queen lineage entry
queensRouter.post('/:id/lineage', async (req: AuthRequest, res, next) => {
    try {
        const data = CreateQueenLineageSchema.parse({ ...req.body, queen_id: req.params.id });

        const result = await pool.query(
            `INSERT INTO queen_lineage (org_id, queen_id, parent_queen_id, parent_drone_source, generation)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [
                req.user!.org_id,
                data.queen_id,
                data.parent_queen_id || null,
                data.parent_drone_source || null,
                data.generation || 1
            ]
        );

        res.status(201).json({ lineage: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

// List breeding plans
queensRouter.get('/breeding-plans', async (req: AuthRequest, res, next) => {
    try {
        const result = await pool.query(
            `SELECT * FROM breeding_plans
             WHERE org_id = $1
             ORDER BY created_at DESC`,
            [req.user!.org_id]
        );

        res.json({ breeding_plans: result.rows });
    } catch (error) {
        next(error);
    }
});

// Get breeding plan by ID
queensRouter.get('/breeding-plans/:id', async (req: AuthRequest, res, next) => {
    try {
        const result = await pool.query(
            `SELECT * FROM breeding_plans
             WHERE id = $1 AND org_id = $2`,
            [req.params.id, req.user!.org_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Breeding plan not found' });
        }

        res.json({ breeding_plan: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

// Create breeding plan
queensRouter.post('/breeding-plans', async (req: AuthRequest, res, next) => {
    try {
        const data = CreateBreedingPlanSchema.parse(req.body);

        const result = await pool.query(
            `INSERT INTO breeding_plans (org_id, name, description, target_traits, timeline_start, timeline_end, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [
                req.user!.org_id,
                data.name,
                data.description || null,
                data.target_traits ? JSON.stringify(data.target_traits) : null,
                data.timeline_start || null,
                data.timeline_end || null,
                data.status || 'planning'
            ]
        );

        const plan = result.rows[0];
        if (plan.target_traits) {
            plan.target_traits = JSON.parse(plan.target_traits);
        }

        await logActivity(
            req.user!.org_id,
            req.user!.id,
            'create_breeding_plan',
            'breeding_plan',
            plan.id,
            { name: plan.name }
        );

        res.status(201).json({ breeding_plan: plan });
    } catch (error) {
        next(error);
    }
});

// Update breeding plan
queensRouter.patch('/breeding-plans/:id', async (req: AuthRequest, res, next) => {
    try {
        const data = UpdateBreedingPlanSchema.parse(req.body);

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
        if (data.target_traits !== undefined) {
            updates.push(`target_traits = $${paramIndex++}`);
            values.push(JSON.stringify(data.target_traits));
        }
        if (data.timeline_start !== undefined) {
            updates.push(`timeline_start = $${paramIndex++}`);
            values.push(data.timeline_start || null);
        }
        if (data.timeline_end !== undefined) {
            updates.push(`timeline_end = $${paramIndex++}`);
            values.push(data.timeline_end || null);
        }
        if (data.status !== undefined) {
            updates.push(`status = $${paramIndex++}`);
            values.push(data.status);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        values.push(req.params.id, req.user!.org_id);

        const result = await pool.query(
            `UPDATE breeding_plans SET ${updates.join(', ')}
             WHERE id = $${paramIndex++} AND org_id = $${paramIndex++}
             RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Breeding plan not found' });
        }

        const plan = result.rows[0];
        if (plan.target_traits) {
            plan.target_traits = JSON.parse(plan.target_traits);
        }

        res.json({ breeding_plan: plan });
    } catch (error) {
        next(error);
    }
});

// Get breeding matches for a plan
queensRouter.get('/breeding-plans/:id/matches', async (req: AuthRequest, res, next) => {
    try {
        const result = await pool.query(
            `SELECT bm.*, qr.name as queen_name, qr.hive_id, h.label as hive_label
             FROM breeding_matches bm
             JOIN queen_records qr ON bm.queen_id = qr.id
             LEFT JOIN hives h ON qr.hive_id = h.id
             WHERE bm.breeding_plan_id = $1 AND bm.org_id = $2
             ORDER BY bm.planned_date`,
            [req.params.id, req.user!.org_id]
        );

        res.json({ matches: result.rows });
    } catch (error) {
        next(error);
    }
});

// Create breeding match
queensRouter.post('/breeding-plans/:id/matches', async (req: AuthRequest, res, next) => {
    try {
        const data = CreateBreedingMatchSchema.parse({ ...req.body, breeding_plan_id: req.params.id });

        const result = await pool.query(
            `INSERT INTO breeding_matches (org_id, breeding_plan_id, queen_id, drone_source, planned_date, status, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [
                req.user!.org_id,
                data.breeding_plan_id,
                data.queen_id,
                data.drone_source || null,
                data.planned_date || null,
                data.status || 'planned',
                data.notes || null
            ]
        );

        res.status(201).json({ match: result.rows[0] });
    } catch (error) {
        next(error);
    }
});
