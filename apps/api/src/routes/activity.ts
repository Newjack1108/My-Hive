import express from 'express';
import { pool } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

export const activityRouter = express.Router();

activityRouter.use(authenticateToken);

// Get activity log
activityRouter.get('/', async (req: AuthRequest, res, next) => {
    try {
        const { limit = '50', entity_type, entity_id } = req.query;

        let query = `
            SELECT al.*, u.name as actor_name
            FROM activity_log al
            LEFT JOIN users u ON al.actor_user_id = u.id
            WHERE al.org_id = $1
        `;
        const params: any[] = [req.user!.org_id];

        if (entity_type) {
            query += ` AND al.entity_type = $${params.length + 1}`;
            params.push(entity_type);
        }

        if (entity_id) {
            query += ` AND al.entity_id = $${params.length + 1}`;
            params.push(entity_id);
        }

        query += ` ORDER BY al.created_at DESC LIMIT $${params.length + 1}`;
        params.push(parseInt(limit as string));

        const result = await pool.query(query, params);

        res.json({ activities: result.rows });
    } catch (error) {
        next(error);
    }
});
