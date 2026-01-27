import express from 'express';
import { pool } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { CreateSeasonalEventSchema, UpdateSeasonalEventSchema } from '@my-hive/shared';
import { logActivity } from '../utils/activity.js';

export const seasonalEventsRouter = express.Router();

seasonalEventsRouter.use(authenticateToken);

// Get all global templates
seasonalEventsRouter.get('/templates', async (req: AuthRequest, res, next) => {
    try {
        const { region, event_type } = req.query;

        let query = `
            SELECT * FROM seasonal_event_templates
            WHERE is_global = true
        `;
        const params: any[] = [];

        if (region) {
            query += ` AND (region = $${params.length + 1} OR region IS NULL)`;
            params.push(region);
        }

        if (event_type) {
            query += ` AND event_type = $${params.length + 1}`;
            params.push(event_type);
        }

        query += ' ORDER BY default_start_month, default_start_day';

        const result = await pool.query(query, params);
        res.json({ templates: result.rows });
    } catch (error) {
        next(error);
    }
});

// List seasonal events
seasonalEventsRouter.get('/', async (req: AuthRequest, res, next) => {
    try {
        const { year, event_type, apiary_id, upcoming } = req.query;

        let query = `
            SELECT se.*, 
                   set.name as template_name,
                   a.name as apiary_name,
                   u.name as created_by_name
            FROM seasonal_events se
            LEFT JOIN seasonal_event_templates set ON se.template_id = set.id
            LEFT JOIN apiaries a ON se.apiary_id = a.id
            LEFT JOIN users u ON se.created_by_user_id = u.id
            WHERE se.org_id = $1
        `;
        const params: any[] = [req.user!.org_id];

        if (year) {
            query += ` AND EXTRACT(YEAR FROM se.start_date) = $${params.length + 1}`;
            params.push(year);
        }

        if (event_type) {
            query += ` AND se.event_type = $${params.length + 1}`;
            params.push(event_type);
        }

        if (apiary_id) {
            query += ` AND se.apiary_id = $${params.length + 1}`;
            params.push(apiary_id);
        }

        if (upcoming === 'true') {
            query += ` AND se.end_date >= CURRENT_DATE`;
        }

        query += ' ORDER BY se.start_date ASC, se.created_at DESC';

        const result = await pool.query(query, params);
        res.json({ events: result.rows });
    } catch (error) {
        next(error);
    }
});

// Get upcoming events
seasonalEventsRouter.get('/upcoming', async (req: AuthRequest, res, next) => {
    try {
        const { limit = '10' } = req.query;
        const limitNum = parseInt(limit as string, 10);

        const result = await pool.query(
            `SELECT se.*, 
                    set.name as template_name,
                    a.name as apiary_name
             FROM seasonal_events se
             LEFT JOIN seasonal_event_templates set ON se.template_id = set.id
             LEFT JOIN apiaries a ON se.apiary_id = a.id
             WHERE se.org_id = $1 
               AND (se.end_date >= CURRENT_DATE OR se.end_date IS NULL)
             ORDER BY se.start_date ASC
             LIMIT $2`,
            [req.user!.org_id, limitNum]
        );

        res.json({ events: result.rows });
    } catch (error) {
        next(error);
    }
});

// Get event by ID
seasonalEventsRouter.get('/:id', async (req: AuthRequest, res, next) => {
    try {
        const result = await pool.query(
            `SELECT se.*, 
                    set.name as template_name, set.description as template_description,
                    a.name as apiary_name,
                    u.name as created_by_name
             FROM seasonal_events se
             LEFT JOIN seasonal_event_templates set ON se.template_id = set.id
             LEFT JOIN apiaries a ON se.apiary_id = a.id
             LEFT JOIN users u ON se.created_by_user_id = u.id
             WHERE se.id = $1 AND se.org_id = $2`,
            [req.params.id, req.user!.org_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Seasonal event not found' });
        }

        res.json({ event: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

// Create event from template
seasonalEventsRouter.post('/from-template/:templateId', async (req: AuthRequest, res, next) => {
    try {
        if (!['admin', 'manager', 'inspector'].includes(req.user!.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        // Get template
        const templateResult = await pool.query(
            'SELECT * FROM seasonal_event_templates WHERE id = $1 AND is_global = true',
            [req.params.templateId]
        );

        if (templateResult.rows.length === 0) {
            return res.status(404).json({ error: 'Template not found' });
        }

        const template = templateResult.rows[0];
        const currentYear = new Date().getFullYear();

        // Calculate dates for current year
        let startDate: Date;
        let endDate: Date | null = null;

        if (template.default_start_month && template.default_start_day) {
            startDate = new Date(currentYear, template.default_start_month - 1, template.default_start_day);
        } else {
            startDate = new Date();
        }

        if (template.default_end_month && template.default_end_day) {
            endDate = new Date(currentYear, template.default_end_month - 1, template.default_end_day);
        } else if (template.default_duration_days) {
            endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + template.default_duration_days);
        }

        const eventData = {
            template_id: template.id,
            name: template.name,
            event_type: template.event_type,
            description: template.description,
            start_date: startDate.toISOString().split('T')[0],
            end_date: endDate ? endDate.toISOString().split('T')[0] : null,
            recurring: true,
            recurring_start_month: template.default_start_month,
            recurring_start_day: template.default_start_day,
            recurring_duration_days: template.default_duration_days || (endDate && startDate ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) : null),
            color: template.color,
            ...req.body // Allow override of any fields
        };

        const data = CreateSeasonalEventSchema.parse(eventData);

        const result = await pool.query(
            `INSERT INTO seasonal_events (
                org_id, template_id, name, event_type, description,
                start_date, end_date, recurring, recurring_start_month,
                recurring_start_day, recurring_duration_days, apiary_id,
                notes, color, created_by_user_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING *`,
            [
                req.user!.org_id,
                data.template_id || null,
                data.name,
                data.event_type,
                data.description || null,
                data.start_date,
                data.end_date || null,
                data.recurring || false,
                data.recurring_start_month || null,
                data.recurring_start_day || null,
                data.recurring_duration_days || null,
                data.apiary_id || null,
                data.notes || null,
                data.color || '#10b981',
                req.user!.id
            ]
        );

        const event = result.rows[0];

        await logActivity(
            req.user!.org_id,
            req.user!.id,
            'create_seasonal_event',
            'seasonal_event',
            event.id,
            { name: event.name, event_type: event.event_type }
        );

        res.status(201).json({ event });
    } catch (error) {
        next(error);
    }
});

// Create custom event
seasonalEventsRouter.post('/', async (req: AuthRequest, res, next) => {
    try {
        if (!['admin', 'manager', 'inspector'].includes(req.user!.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const data = CreateSeasonalEventSchema.parse(req.body);

        const result = await pool.query(
            `INSERT INTO seasonal_events (
                org_id, template_id, name, event_type, description,
                start_date, end_date, recurring, recurring_start_month,
                recurring_start_day, recurring_duration_days, apiary_id,
                notes, color, created_by_user_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING *`,
            [
                req.user!.org_id,
                data.template_id || null,
                data.name,
                data.event_type,
                data.description || null,
                data.start_date,
                data.end_date || null,
                data.recurring || false,
                data.recurring_start_month || null,
                data.recurring_start_day || null,
                data.recurring_duration_days || null,
                data.apiary_id || null,
                data.notes || null,
                data.color || '#10b981',
                req.user!.id
            ]
        );

        const event = result.rows[0];

        await logActivity(
            req.user!.org_id,
            req.user!.id,
            'create_seasonal_event',
            'seasonal_event',
            event.id,
            { name: event.name, event_type: event.event_type }
        );

        res.status(201).json({ event });
    } catch (error) {
        next(error);
    }
});

// Update event
seasonalEventsRouter.patch('/:id', async (req: AuthRequest, res, next) => {
    try {
        const data = UpdateSeasonalEventSchema.parse(req.body);

        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (data.name !== undefined) {
            updates.push(`name = $${paramIndex++}`);
            values.push(data.name);
        }
        if (data.event_type !== undefined) {
            updates.push(`event_type = $${paramIndex++}`);
            values.push(data.event_type);
        }
        if (data.description !== undefined) {
            updates.push(`description = $${paramIndex++}`);
            values.push(data.description || null);
        }
        if (data.start_date !== undefined) {
            updates.push(`start_date = $${paramIndex++}`);
            values.push(data.start_date);
        }
        if (data.end_date !== undefined) {
            updates.push(`end_date = $${paramIndex++}`);
            values.push(data.end_date || null);
        }
        if (data.recurring !== undefined) {
            updates.push(`recurring = $${paramIndex++}`);
            values.push(data.recurring);
        }
        if (data.recurring_start_month !== undefined) {
            updates.push(`recurring_start_month = $${paramIndex++}`);
            values.push(data.recurring_start_month || null);
        }
        if (data.recurring_start_day !== undefined) {
            updates.push(`recurring_start_day = $${paramIndex++}`);
            values.push(data.recurring_start_day || null);
        }
        if (data.recurring_duration_days !== undefined) {
            updates.push(`recurring_duration_days = $${paramIndex++}`);
            values.push(data.recurring_duration_days || null);
        }
        if (data.apiary_id !== undefined) {
            updates.push(`apiary_id = $${paramIndex++}`);
            values.push(data.apiary_id || null);
        }
        if (data.notes !== undefined) {
            updates.push(`notes = $${paramIndex++}`);
            values.push(data.notes || null);
        }
        if (data.color !== undefined) {
            updates.push(`color = $${paramIndex++}`);
            values.push(data.color);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        updates.push(`updated_at = NOW()`);
        values.push(req.params.id, req.user!.org_id);

        const result = await pool.query(
            `UPDATE seasonal_events SET ${updates.join(', ')}
             WHERE id = $${paramIndex++} AND org_id = $${paramIndex++}
             RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Seasonal event not found' });
        }

        await logActivity(
            req.user!.org_id,
            req.user!.id,
            'update_seasonal_event',
            'seasonal_event',
            req.params.id,
            data
        );

        res.json({ event: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

// Delete event
seasonalEventsRouter.delete('/:id', async (req: AuthRequest, res, next) => {
    try {
        if (!['admin', 'manager'].includes(req.user!.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const result = await pool.query(
            `DELETE FROM seasonal_events
             WHERE id = $1 AND org_id = $2
             RETURNING id`,
            [req.params.id, req.user!.org_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Seasonal event not found' });
        }

        await logActivity(
            req.user!.org_id,
            req.user!.id,
            'delete_seasonal_event',
            'seasonal_event',
            req.params.id,
            {}
        );

        res.status(204).send();
    } catch (error) {
        next(error);
    }
});
