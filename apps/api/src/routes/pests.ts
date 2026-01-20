import express from 'express';
import { pool } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import {
    CreatePestKnowledgeBaseSchema,
    UpdatePestKnowledgeBaseSchema,
    CreatePestTreatmentSchema,
    CreatePestOccurrenceSchema,
    CreateTreatmentEffectivenessSchema
} from '@my-hive/shared';
import { logActivity } from '../utils/activity.js';

export const pestsRouter = express.Router();

pestsRouter.use(authenticateToken);

// Knowledge Base - Get all pests (global + org-specific)
pestsRouter.get('/', async (req: AuthRequest, res, next) => {
    try {
        const search = req.query.search as string | undefined;

        let query = `
            SELECT * FROM pest_knowledge_base
            WHERE (org_id = $1 OR is_global = true)
        `;
        const params: any[] = [req.user!.org_id];

        if (search) {
            query += ` AND (name ILIKE $${params.length + 1} OR scientific_name ILIKE $${params.length + 1} OR description ILIKE $${params.length + 1})`;
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern, searchPattern);
        }

        query += ' ORDER BY is_global DESC, name';

        const result = await pool.query(query, params);

        // Parse JSONB fields
        const pests = result.rows.map(pest => ({
            ...pest,
            treatment_options: pest.treatment_options ? (typeof pest.treatment_options === 'string' ? JSON.parse(pest.treatment_options) : pest.treatment_options) : null
        }));

        res.json({ pests });
    } catch (error) {
        next(error);
    }
});

// Get pest by ID
pestsRouter.get('/:id', async (req: AuthRequest, res, next) => {
    try {
        const result = await pool.query(
            `SELECT * FROM pest_knowledge_base
             WHERE id = $1 AND (org_id = $2 OR is_global = true)`,
            [req.params.id, req.user!.org_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Pest not found' });
        }

        const pest = result.rows[0];
        if (pest.treatment_options) {
            pest.treatment_options = typeof pest.treatment_options === 'string' ? JSON.parse(pest.treatment_options) : pest.treatment_options;
        }

        // Get treatments for this pest
        const treatmentsResult = await pool.query(
            `SELECT * FROM pest_treatments
             WHERE pest_id = $1 AND (org_id = $2 OR is_global = true)
             ORDER BY effectiveness_rating DESC NULLS LAST`,
            [req.params.id, req.user!.org_id]
        );

        res.json({
            pest,
            treatments: treatmentsResult.rows
        });
    } catch (error) {
        next(error);
    }
});

// Search pests by symptoms
pestsRouter.get('/search/symptoms', async (req: AuthRequest, res, next) => {
    try {
        const symptoms = req.query.symptoms as string;
        if (!symptoms) {
            return res.status(400).json({ error: 'Symptoms parameter required' });
        }

        const result = await pool.query(
            `SELECT * FROM pest_knowledge_base
             WHERE (org_id = $1 OR is_global = true)
               AND symptoms ILIKE $2
             ORDER BY severity_level DESC, name`,
            [req.user!.org_id, `%${symptoms}%`]
        );

        const pests = result.rows.map(pest => ({
            ...pest,
            treatment_options: pest.treatment_options ? (typeof pest.treatment_options === 'string' ? JSON.parse(pest.treatment_options) : pest.treatment_options) : null
        }));

        res.json({ pests });
    } catch (error) {
        next(error);
    }
});

// Create pest (admin/manager only, for org-specific pests)
pestsRouter.post('/', async (req: AuthRequest, res, next) => {
    try {
        if (!['admin', 'manager'].includes(req.user!.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const data = CreatePestKnowledgeBaseSchema.parse(req.body);

        const result = await pool.query(
            `INSERT INTO pest_knowledge_base (org_id, name, scientific_name, description, symptoms, treatment_options, prevention_methods, severity_level, is_global)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [
                req.user!.org_id,
                data.name,
                data.scientific_name || null,
                data.description || null,
                data.symptoms || null,
                data.treatment_options ? JSON.stringify(data.treatment_options) : null,
                data.prevention_methods || null,
                data.severity_level || null,
                data.is_global || false
            ]
        );

        const pest = result.rows[0];
        if (pest.treatment_options) {
            pest.treatment_options = JSON.parse(pest.treatment_options);
        }

        res.status(201).json({ pest });
    } catch (error) {
        next(error);
    }
});

// Update pest
pestsRouter.patch('/:id', async (req: AuthRequest, res, next) => {
    try {
        if (!['admin', 'manager'].includes(req.user!.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const data = UpdatePestKnowledgeBaseSchema.parse(req.body);

        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (data.name !== undefined) {
            updates.push(`name = $${paramIndex++}`);
            values.push(data.name);
        }
        if (data.scientific_name !== undefined) {
            updates.push(`scientific_name = $${paramIndex++}`);
            values.push(data.scientific_name || null);
        }
        if (data.description !== undefined) {
            updates.push(`description = $${paramIndex++}`);
            values.push(data.description || null);
        }
        if (data.symptoms !== undefined) {
            updates.push(`symptoms = $${paramIndex++}`);
            values.push(data.symptoms || null);
        }
        if (data.treatment_options !== undefined) {
            updates.push(`treatment_options = $${paramIndex++}`);
            values.push(JSON.stringify(data.treatment_options));
        }
        if (data.prevention_methods !== undefined) {
            updates.push(`prevention_methods = $${paramIndex++}`);
            values.push(data.prevention_methods || null);
        }
        if (data.severity_level !== undefined) {
            updates.push(`severity_level = $${paramIndex++}`);
            values.push(data.severity_level || null);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        values.push(req.params.id, req.user!.org_id);

        const result = await pool.query(
            `UPDATE pest_knowledge_base SET ${updates.join(', ')}
             WHERE id = $${paramIndex++} AND org_id = $${paramIndex++}
             RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Pest not found' });
        }

        const pest = result.rows[0];
        if (pest.treatment_options) {
            pest.treatment_options = JSON.parse(pest.treatment_options);
        }

        res.json({ pest });
    } catch (error) {
        next(error);
    }
});

// Treatments
pestsRouter.post('/:id/treatments', async (req: AuthRequest, res, next) => {
    try {
        if (!['admin', 'manager'].includes(req.user!.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const data = CreatePestTreatmentSchema.parse({ ...req.body, pest_id: req.params.id });

        const result = await pool.query(
            `INSERT INTO pest_treatments (org_id, pest_id, treatment_name, treatment_method, products, application_instructions, effectiveness_rating, is_global)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [
                req.user!.org_id,
                data.pest_id,
                data.treatment_name,
                data.treatment_method || null,
                data.products || null,
                data.application_instructions || null,
                data.effectiveness_rating || null,
                data.is_global || false
            ]
        );

        res.status(201).json({ treatment: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

// Pest Occurrences
pestsRouter.get('/occurrences', async (req: AuthRequest, res, next) => {
    try {
        const hiveId = req.query.hive_id as string | undefined;
        const pestId = req.query.pest_id as string | undefined;

        let query = `
            SELECT po.*, p.name as pest_name, h.label as hive_label
            FROM pest_occurrences po
            JOIN pest_knowledge_base p ON po.pest_id = p.id
            JOIN hives h ON po.hive_id = h.id
            WHERE po.org_id = $1
        `;
        const params: any[] = [req.user!.org_id];

        if (hiveId) {
            query += ' AND po.hive_id = $2';
            params.push(hiveId);
        }

        if (pestId) {
            query += ` AND po.pest_id = $${params.length + 1}`;
            params.push(pestId);
        }

        query += ' ORDER BY po.occurrence_date DESC';

        const result = await pool.query(query, params);
        res.json({ occurrences: result.rows });
    } catch (error) {
        next(error);
    }
});

pestsRouter.post('/occurrences', async (req: AuthRequest, res, next) => {
    try {
        const data = CreatePestOccurrenceSchema.parse(req.body);

        const result = await pool.query(
            `INSERT INTO pest_occurrences (org_id, hive_id, pest_id, inspection_id, occurrence_date, severity, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [
                req.user!.org_id,
                data.hive_id,
                data.pest_id,
                data.inspection_id || null,
                data.occurrence_date,
                data.severity || null,
                data.notes || null
            ]
        );

        const occurrence = result.rows[0];

        await logActivity(
            req.user!.org_id,
            req.user!.id,
            'report_pest_occurrence',
            'pest_occurrence',
            occurrence.id,
            { pest_id: occurrence.pest_id, hive_id: occurrence.hive_id }
        );

        res.status(201).json({ occurrence });
    } catch (error) {
        next(error);
    }
});

// Record treatment application
pestsRouter.post('/occurrences/:id/treat', async (req: AuthRequest, res, next) => {
    try {
        const data = CreateTreatmentEffectivenessSchema.parse({ ...req.body, pest_occurrence_id: req.params.id });

        // Verify occurrence exists
        const occurrenceResult = await pool.query(
            `SELECT * FROM pest_occurrences
             WHERE id = $1 AND org_id = $2`,
            [req.params.id, req.user!.org_id]
        );

        if (occurrenceResult.rows.length === 0) {
            return res.status(404).json({ error: 'Pest occurrence not found' });
        }

        const result = await pool.query(
            `INSERT INTO treatment_effectiveness (org_id, pest_occurrence_id, treatment_id, treatment_date, effectiveness_rating, notes)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [
                req.user!.org_id,
                data.pest_occurrence_id,
                data.treatment_id,
                data.treatment_date,
                data.effectiveness_rating || null,
                data.notes || null
            ]
        );

        await logActivity(
            req.user!.org_id,
            req.user!.id,
            'apply_pest_treatment',
            'treatment_effectiveness',
            result.rows[0].id,
            { pest_occurrence_id: data.pest_occurrence_id, treatment_id: data.treatment_id }
        );

        res.status(201).json({ treatment_effectiveness: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

// Get treatment history for an occurrence
pestsRouter.get('/occurrences/:id/treatments', async (req: AuthRequest, res, next) => {
    try {
        const result = await pool.query(
            `SELECT te.*, pt.treatment_name, pt.treatment_method
             FROM treatment_effectiveness te
             JOIN pest_treatments pt ON te.treatment_id = pt.id
             WHERE te.pest_occurrence_id = $1 AND te.org_id = $2
             ORDER BY te.treatment_date DESC`,
            [req.params.id, req.user!.org_id]
        );

        res.json({ treatments: result.rows });
    } catch (error) {
        next(error);
    }
});
