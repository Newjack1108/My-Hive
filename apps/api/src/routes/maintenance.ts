import express from 'express';
import { pool } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import {
    CreateMaintenanceTemplateSchema,
    UpdateMaintenanceTemplateSchema,
    CreateMaintenanceScheduleSchema,
    UpdateMaintenanceScheduleSchema,
    CreateMaintenanceHistorySchema
} from '@my-hive/shared';
import { logActivity } from '../utils/activity.js';

export const maintenanceRouter = express.Router();

maintenanceRouter.use(authenticateToken);

// Templates
maintenanceRouter.get('/templates', async (req: AuthRequest, res, next) => {
    try {
        const result = await pool.query(
            `SELECT * FROM maintenance_templates
             WHERE org_id = $1
             ORDER BY name`,
            [req.user!.org_id]
        );

        // Parse JSONB fields
        const templates = result.rows.map(template => ({
            ...template,
            checklist_items: template.checklist_items ? (typeof template.checklist_items === 'string' ? JSON.parse(template.checklist_items) : template.checklist_items) : null
        }));

        res.json({ templates });
    } catch (error) {
        next(error);
    }
});

maintenanceRouter.get('/templates/:id', async (req: AuthRequest, res, next) => {
    try {
        const result = await pool.query(
            `SELECT * FROM maintenance_templates
             WHERE id = $1 AND org_id = $2`,
            [req.params.id, req.user!.org_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Template not found' });
        }

        const template = result.rows[0];
        if (template.checklist_items) {
            template.checklist_items = typeof template.checklist_items === 'string' ? JSON.parse(template.checklist_items) : template.checklist_items;
        }

        res.json({ template });
    } catch (error) {
        next(error);
    }
});

maintenanceRouter.post('/templates', async (req: AuthRequest, res, next) => {
    try {
        if (!['admin', 'manager'].includes(req.user!.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const data = CreateMaintenanceTemplateSchema.parse(req.body);

        const result = await pool.query(
            `INSERT INTO maintenance_templates (org_id, name, description, task_type, default_duration_days, instructions, checklist_items)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [
                req.user!.org_id,
                data.name,
                data.description || null,
                data.task_type,
                data.default_duration_days || null,
                data.instructions || null,
                data.checklist_items ? JSON.stringify(data.checklist_items) : null
            ]
        );

        const template = result.rows[0];
        if (template.checklist_items) {
            template.checklist_items = JSON.parse(template.checklist_items);
        }

        res.status(201).json({ template });
    } catch (error) {
        next(error);
    }
});

maintenanceRouter.patch('/templates/:id', async (req: AuthRequest, res, next) => {
    try {
        if (!['admin', 'manager'].includes(req.user!.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const data = UpdateMaintenanceTemplateSchema.parse(req.body);

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
        if (data.task_type !== undefined) {
            updates.push(`task_type = $${paramIndex++}`);
            values.push(data.task_type);
        }
        if (data.default_duration_days !== undefined) {
            updates.push(`default_duration_days = $${paramIndex++}`);
            values.push(data.default_duration_days || null);
        }
        if (data.instructions !== undefined) {
            updates.push(`instructions = $${paramIndex++}`);
            values.push(data.instructions || null);
        }
        if (data.checklist_items !== undefined) {
            updates.push(`checklist_items = $${paramIndex++}`);
            values.push(JSON.stringify(data.checklist_items));
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        values.push(req.params.id, req.user!.org_id);

        const result = await pool.query(
            `UPDATE maintenance_templates SET ${updates.join(', ')}
             WHERE id = $${paramIndex++} AND org_id = $${paramIndex++}
             RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Template not found' });
        }

        const template = result.rows[0];
        if (template.checklist_items) {
            template.checklist_items = JSON.parse(template.checklist_items);
        }

        res.json({ template });
    } catch (error) {
        next(error);
    }
});

// Delete template
maintenanceRouter.delete('/templates/:id', async (req: AuthRequest, res, next) => {
    try {
        if (!['admin', 'manager'].includes(req.user!.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        // Check if template exists and belongs to org
        const checkResult = await pool.query(
            `SELECT id FROM maintenance_templates
             WHERE id = $1 AND org_id = $2`,
            [req.params.id, req.user!.org_id]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Template not found' });
        }

        // Check if template is used by any schedules
        const schedulesResult = await pool.query(
            `SELECT COUNT(*) as count FROM maintenance_schedules
             WHERE template_id = $1`,
            [req.params.id]
        );

        if (parseInt(schedulesResult.rows[0]?.count || '0') > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete template that is used by existing schedules. Please remove or update the schedules first.' 
            });
        }

        // Delete the template
        await pool.query(
            `DELETE FROM maintenance_templates
             WHERE id = $1 AND org_id = $2`,
            [req.params.id, req.user!.org_id]
        );

        await logActivity(
            req.user!.org_id,
            req.user!.id,
            'delete_maintenance_template',
            'maintenance_template',
            req.params.id,
            {}
        );

        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

// Schedules
maintenanceRouter.get('/schedules', async (req: AuthRequest, res, next) => {
    try {
        const hiveId = req.query.hive_id as string | undefined;
        const activeOnly = req.query.active !== 'false';

        let query = `
            SELECT ms.*, mt.name as template_name, mt.task_type, h.label as hive_label
            FROM maintenance_schedules ms
            LEFT JOIN maintenance_templates mt ON ms.template_id = mt.id
            LEFT JOIN hives h ON ms.hive_id = h.id
            WHERE ms.org_id = $1
        `;
        const params: any[] = [req.user!.org_id];

        if (activeOnly) {
            query += ' AND ms.is_active = true';
        }

        if (hiveId) {
            query += ` AND ms.hive_id = $${params.length + 1}`;
            params.push(hiveId);
        }

        query += ' ORDER BY ms.next_due_date';

        const result = await pool.query(query, params);
        res.json({ schedules: result.rows });
    } catch (error) {
        next(error);
    }
});

maintenanceRouter.get('/schedules/:id', async (req: AuthRequest, res, next) => {
    try {
        const result = await pool.query(
            `SELECT ms.*, mt.name as template_name, mt.task_type, h.label as hive_label
             FROM maintenance_schedules ms
             LEFT JOIN maintenance_templates mt ON ms.template_id = mt.id
             LEFT JOIN hives h ON ms.hive_id = h.id
             WHERE ms.id = $1 AND ms.org_id = $2`,
            [req.params.id, req.user!.org_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Schedule not found' });
        }

        res.json({ schedule: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

maintenanceRouter.post('/schedules', async (req: AuthRequest, res, next) => {
    try {
        const data = CreateMaintenanceScheduleSchema.parse(req.body);

        const result = await pool.query(
            `INSERT INTO maintenance_schedules (org_id, template_id, hive_id, name, frequency_type, frequency_value, next_due_date, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [
                req.user!.org_id,
                data.template_id || null,
                data.hive_id || null,
                data.name,
                data.frequency_type,
                data.frequency_value || 1,
                data.next_due_date,
                data.is_active !== false
            ]
        );

        res.status(201).json({ schedule: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

maintenanceRouter.patch('/schedules/:id', async (req: AuthRequest, res, next) => {
    try {
        const data = UpdateMaintenanceScheduleSchema.parse(req.body);

        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (data.template_id !== undefined) {
            updates.push(`template_id = $${paramIndex++}`);
            values.push(data.template_id || null);
        }
        if (data.hive_id !== undefined) {
            updates.push(`hive_id = $${paramIndex++}`);
            values.push(data.hive_id || null);
        }
        if (data.name !== undefined) {
            updates.push(`name = $${paramIndex++}`);
            values.push(data.name);
        }
        if (data.frequency_type !== undefined) {
            updates.push(`frequency_type = $${paramIndex++}`);
            values.push(data.frequency_type);
        }
        if (data.frequency_value !== undefined) {
            updates.push(`frequency_value = $${paramIndex++}`);
            values.push(data.frequency_value);
        }
        if (data.next_due_date !== undefined) {
            updates.push(`next_due_date = $${paramIndex++}`);
            values.push(data.next_due_date);
        }
        if (data.is_active !== undefined) {
            updates.push(`is_active = $${paramIndex++}`);
            values.push(data.is_active);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        values.push(req.params.id, req.user!.org_id);

        const result = await pool.query(
            `UPDATE maintenance_schedules SET ${updates.join(', ')}
             WHERE id = $${paramIndex++} AND org_id = $${paramIndex++}
             RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Schedule not found' });
        }

        res.json({ schedule: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

// Delete schedule
maintenanceRouter.delete('/schedules/:id', async (req: AuthRequest, res, next) => {
    try {
        // Check if schedule exists and belongs to org
        const checkResult = await pool.query(
            `SELECT id FROM maintenance_schedules
             WHERE id = $1 AND org_id = $2`,
            [req.params.id, req.user!.org_id]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Schedule not found' });
        }

        // Delete the schedule (CASCADE will handle related records)
        await pool.query(
            `DELETE FROM maintenance_schedules
             WHERE id = $1 AND org_id = $2`,
            [req.params.id, req.user!.org_id]
        );

        await logActivity(
            req.user!.org_id,
            req.user!.id,
            'delete_maintenance_schedule',
            'maintenance_schedule',
            req.params.id,
            {}
        );

        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

// Get upcoming maintenance tasks
maintenanceRouter.get('/upcoming', async (req: AuthRequest, res, next) => {
    try {
        const daysAhead = parseInt(req.query.days as string) || 30;

        const result = await pool.query(
            `SELECT ms.*, mt.name as template_name, mt.task_type, h.label as hive_label
             FROM maintenance_schedules ms
             LEFT JOIN maintenance_templates mt ON ms.template_id = mt.id
             LEFT JOIN hives h ON ms.hive_id = h.id
             WHERE ms.org_id = $1
               AND ms.is_active = true
               AND ms.next_due_date <= CURRENT_DATE + INTERVAL '${daysAhead} days'
             ORDER BY ms.next_due_date`,
            [req.user!.org_id]
        );

        res.json({ upcoming: result.rows });
    } catch (error) {
        next(error);
    }
});

// Complete schedule and reschedule
maintenanceRouter.post('/schedules/:id/complete', async (req: AuthRequest, res, next) => {
    try {
        const data = CreateMaintenanceHistorySchema.parse(req.body);

        // Get schedule
        const scheduleResult = await pool.query(
            `SELECT * FROM maintenance_schedules
             WHERE id = $1 AND org_id = $2`,
            [req.params.id, req.user!.org_id]
        );

        if (scheduleResult.rows.length === 0) {
            return res.status(404).json({ error: 'Schedule not found' });
        }

        const schedule = scheduleResult.rows[0];

        // Record history - store checklist_completed and inspection_id in notes as JSON if provided
        let notesWithMetadata = data.notes || null;
        if (data.checklist_completed && data.checklist_completed.length > 0 || data.inspection_id) {
            const metadata: any = {
                original_notes: data.notes || null
            };
            if (data.checklist_completed && data.checklist_completed.length > 0) {
                metadata.checklist_completed = data.checklist_completed;
            }
            if (data.inspection_id) {
                metadata.inspection_id = data.inspection_id;
            }
            notesWithMetadata = JSON.stringify(metadata);
        }

        const historyResult = await pool.query(
            `INSERT INTO maintenance_history (org_id, schedule_id, hive_id, completed_by_user_id, completed_date, notes)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [
                req.user!.org_id,
                schedule.id,
                data.hive_id || schedule.hive_id,
                req.user!.id,
                data.completed_date,
                notesWithMetadata
            ]
        );

        // Calculate next due date
        let nextDueDate: Date;
        const completedDate = new Date(data.completed_date);
        const frequencyValue = schedule.frequency_value || 1;

        switch (schedule.frequency_type) {
            case 'daily':
                nextDueDate = new Date(completedDate);
                nextDueDate.setDate(nextDueDate.getDate() + frequencyValue);
                break;
            case 'weekly':
                nextDueDate = new Date(completedDate);
                nextDueDate.setDate(nextDueDate.getDate() + (frequencyValue * 7));
                break;
            case 'monthly':
                nextDueDate = new Date(completedDate);
                nextDueDate.setMonth(nextDueDate.getMonth() + frequencyValue);
                break;
            case 'quarterly':
                nextDueDate = new Date(completedDate);
                nextDueDate.setMonth(nextDueDate.getMonth() + (frequencyValue * 3));
                break;
            case 'yearly':
                nextDueDate = new Date(completedDate);
                nextDueDate.setFullYear(nextDueDate.getFullYear() + frequencyValue);
                break;
            default:
                nextDueDate = new Date(completedDate);
                nextDueDate.setDate(nextDueDate.getDate() + (frequencyValue * 30));
        }

        // Update schedule
        await pool.query(
            `UPDATE maintenance_schedules
             SET last_completed_date = $1, next_due_date = $2
             WHERE id = $3`,
            [data.completed_date, nextDueDate.toISOString().split('T')[0], schedule.id]
        );

        // Create task if template exists
        if (schedule.template_id) {
            const templateResult = await pool.query(
                `SELECT * FROM maintenance_templates WHERE id = $1`,
                [schedule.template_id]
            );

            if (templateResult.rows.length > 0) {
                const template = templateResult.rows[0];
                await pool.query(
                    `INSERT INTO tasks (org_id, hive_id, type, title, description, due_date, template_id, recurring_schedule_id)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [
                        req.user!.org_id,
                        schedule.hive_id,
                        template.task_type,
                        template.name,
                        template.instructions,
                        nextDueDate.toISOString().split('T')[0],
                        schedule.template_id,
                        schedule.id
                    ]
                );
            }
        }

        await logActivity(
            req.user!.org_id,
            req.user!.id,
            'complete_maintenance',
            'maintenance_schedule',
            schedule.id,
            { next_due_date: nextDueDate.toISOString().split('T')[0] }
        );

        res.json({
            history: historyResult.rows[0],
            next_due_date: nextDueDate.toISOString().split('T')[0]
        });
    } catch (error) {
        next(error);
    }
});

// Maintenance History
maintenanceRouter.get('/history', async (req: AuthRequest, res, next) => {
    try {
        const hiveId = req.query.hive_id as string | undefined;
        const scheduleId = req.query.schedule_id as string | undefined;

        let query = `
            SELECT mh.*, u.name as completed_by_name, h.label as hive_label, ms.name as schedule_name
            FROM maintenance_history mh
            LEFT JOIN users u ON mh.completed_by_user_id = u.id
            LEFT JOIN hives h ON mh.hive_id = h.id
            LEFT JOIN maintenance_schedules ms ON mh.schedule_id = ms.id
            WHERE mh.org_id = $1
        `;
        const params: any[] = [req.user!.org_id];

        if (hiveId) {
            query += ' AND mh.hive_id = $2';
            params.push(hiveId);
        }

        if (scheduleId) {
            query += ` AND mh.schedule_id = $${params.length + 1}`;
            params.push(scheduleId);
        }

        query += ' ORDER BY mh.completed_date DESC';

        const result = await pool.query(query, params);
        res.json({ history: result.rows });
    } catch (error) {
        next(error);
    }
});

// Bulk create schedules
maintenanceRouter.post('/schedules/bulk', async (req: AuthRequest, res, next) => {
    try {
        if (!['admin', 'manager'].includes(req.user!.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const { schedules } = req.body;
        if (!Array.isArray(schedules) || schedules.length === 0) {
            return res.status(400).json({ error: 'schedules array is required' });
        }

        // Validate all schedules
        for (const scheduleData of schedules) {
            CreateMaintenanceScheduleSchema.parse(scheduleData);
        }

        // Create all schedules in a transaction
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const createdSchedules = [];
            for (const scheduleData of schedules) {
                const result = await client.query(
                    `INSERT INTO maintenance_schedules (org_id, template_id, hive_id, name, frequency_type, frequency_value, next_due_date, is_active)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                     RETURNING *`,
                    [
                        req.user!.org_id,
                        scheduleData.template_id || null,
                        scheduleData.hive_id || null,
                        scheduleData.name,
                        scheduleData.frequency_type,
                        scheduleData.frequency_value || 1,
                        scheduleData.next_due_date,
                        scheduleData.is_active !== false
                    ]
                );
                createdSchedules.push(result.rows[0]);
            }

            await client.query('COMMIT');
            res.status(201).json({ schedules: createdSchedules, count: createdSchedules.length });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        next(error);
    }
});

// Get maintenance statistics
maintenanceRouter.get('/stats', async (req: AuthRequest, res, next) => {
    try {
        const orgId = req.user!.org_id;

        // Total schedules
        const totalSchedulesResult = await pool.query(
            `SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE is_active = true) as active,
                COUNT(*) FILTER (WHERE is_active = false) as inactive
             FROM maintenance_schedules
             WHERE org_id = $1`,
            [orgId]
        );

        // Overdue count
        const overdueResult = await pool.query(
            `SELECT COUNT(*) as count
             FROM maintenance_schedules
             WHERE org_id = $1
               AND is_active = true
               AND next_due_date < CURRENT_DATE`,
            [orgId]
        );

        // Completion rate (last 30 days)
        const completionRateResult = await pool.query(
            `SELECT 
                COUNT(DISTINCT ms.id) FILTER (WHERE mh.completed_date >= CURRENT_DATE - INTERVAL '30 days') as completed,
                COUNT(DISTINCT ms.id) FILTER (WHERE ms.next_due_date <= CURRENT_DATE AND ms.next_due_date >= CURRENT_DATE - INTERVAL '30 days') as total_due
             FROM maintenance_schedules ms
             LEFT JOIN maintenance_history mh ON ms.id = mh.schedule_id
             WHERE ms.org_id = $1
               AND ms.is_active = true`,
            [orgId]
        );

        // Average days to complete after due date
        const avgDaysResult = await pool.query(
            `SELECT AVG(EXTRACT(EPOCH FROM (mh.completed_date - ms.next_due_date)) / 86400) as avg_days
             FROM maintenance_history mh
             JOIN maintenance_schedules ms ON mh.schedule_id = ms.id
             WHERE mh.org_id = $1
               AND mh.completed_date >= ms.next_due_date
               AND mh.completed_date >= CURRENT_DATE - INTERVAL '90 days'`,
            [orgId]
        );

        const totalSchedules = totalSchedulesResult.rows[0];
        const overdueCount = parseInt(overdueResult.rows[0]?.count || '0');
        const completionRate = completionRateResult.rows[0];
        const totalDue = parseInt(completionRate.total_due || '0');
        const completed = parseInt(completionRate.completed || '0');
        const completionRate30d = totalDue > 0 ? completed / totalDue : null;
        const avgDays = avgDaysResult.rows[0]?.avg_days ? parseFloat(avgDaysResult.rows[0].avg_days) : null;

        res.json({
            total_schedules: parseInt(totalSchedules.total || '0'),
            active_schedules: parseInt(totalSchedules.active || '0'),
            inactive_schedules: parseInt(totalSchedules.inactive || '0'),
            overdue_count: overdueCount,
            completion_rate_30d: completionRate30d,
            avg_days_to_complete: avgDays
        });
    } catch (error) {
        next(error);
    }
});
