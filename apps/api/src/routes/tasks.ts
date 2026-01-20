import express from 'express';
import { pool } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { CreateTaskSchema, UpdateTaskSchema } from '@my-hive/shared';
import { logActivity } from '../utils/activity.js';

export const tasksRouter = express.Router();

tasksRouter.use(authenticateToken);

// List tasks
tasksRouter.get('/', async (req: AuthRequest, res, next) => {
    try {
        const { status, assigned_to_me, due_date } = req.query;

        let query = `
            SELECT t.*, h.label as hive_label, h.public_id as hive_public_id,
                   u.name as assigned_user_name
            FROM tasks t
            LEFT JOIN hives h ON t.hive_id = h.id
            LEFT JOIN users u ON t.assigned_user_id = u.id
            WHERE t.org_id = $1
        `;
        const params: any[] = [req.user!.org_id];

        if (status) {
            query += ` AND t.status = $${params.length + 1}`;
            params.push(status);
        }

        if (assigned_to_me === 'true') {
            query += ` AND t.assigned_user_id = $${params.length + 1}`;
            params.push(req.user!.id);
        }

        if (due_date) {
            query += ` AND t.due_date <= $${params.length + 1}`;
            params.push(due_date);
        }

        query += ' ORDER BY t.due_date ASC, t.created_at DESC';

        const result = await pool.query(query, params);

        res.json({ tasks: result.rows });
    } catch (error) {
        next(error);
    }
});

// Get task by ID
tasksRouter.get('/:id', async (req: AuthRequest, res, next) => {
    try {
        const result = await pool.query(
            `SELECT t.*, h.label as hive_label, h.public_id as hive_public_id,
                    u.name as assigned_user_name
             FROM tasks t
             LEFT JOIN hives h ON t.hive_id = h.id
             LEFT JOIN users u ON t.assigned_user_id = u.id
             WHERE t.id = $1 AND t.org_id = $2`,
            [req.params.id, req.user!.org_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        res.json({ task: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

// Create task
tasksRouter.post('/', async (req: AuthRequest, res, next) => {
    try {
        if (!['admin', 'manager', 'inspector'].includes(req.user!.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const data = CreateTaskSchema.parse(req.body);

        const result = await pool.query(
            `INSERT INTO tasks (
                org_id, hive_id, inspection_id, type, title, description,
                due_date, assigned_user_id, status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *`,
            [
                req.user!.org_id,
                data.hive_id || null,
                data.inspection_id || null,
                data.type,
                data.title,
                data.description || null,
                data.due_date,
                data.assigned_user_id || null,
                'pending',
            ]
        );

        const task = result.rows[0];

        await logActivity(
            req.user!.org_id,
            req.user!.id,
            'create_task',
            'task',
            task.id,
            { title: task.title, due_date: task.due_date }
        );

        res.status(201).json({ task });
    } catch (error) {
        next(error);
    }
});

// Update task
tasksRouter.patch('/:id', async (req: AuthRequest, res, next) => {
    try {
        const data = UpdateTaskSchema.parse(req.body);

        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (data.status !== undefined) {
            updates.push(`status = $${paramIndex++}`);
            values.push(data.status);
            if (data.status === 'completed') {
                updates.push(`completed_at = NOW()`);
            }
        }
        if (data.title !== undefined) {
            updates.push(`title = $${paramIndex++}`);
            values.push(data.title);
        }
        if (data.description !== undefined) {
            updates.push(`description = $${paramIndex++}`);
            values.push(data.description || null);
        }
        if (data.due_date !== undefined) {
            updates.push(`due_date = $${paramIndex++}`);
            values.push(data.due_date);
        }
        if (data.assigned_user_id !== undefined) {
            updates.push(`assigned_user_id = $${paramIndex++}`);
            values.push(data.assigned_user_id || null);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        values.push(req.params.id, req.user!.org_id);

        const result = await pool.query(
            `UPDATE tasks SET ${updates.join(', ')}
             WHERE id = $${paramIndex++} AND org_id = $${paramIndex++}
             RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        await logActivity(
            req.user!.org_id,
            req.user!.id,
            'update_task',
            'task',
            req.params.id,
            data
        );

        res.json({ task: result.rows[0] });
    } catch (error) {
        next(error);
    }
});
