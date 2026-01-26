import express from 'express';
import { pool } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { CreateHiveSplitSchema, UpdateHiveSplitSchema } from '@my-hive/shared';
import { logActivity } from '../utils/activity.js';

export const splitsRouter = express.Router();

splitsRouter.use(authenticateToken);

// List splits
splitsRouter.get('/', async (req: AuthRequest, res, next) => {
    try {
        const { parent_hive_id, start_date, end_date } = req.query;

        let query = `
            SELECT hs.*, 
                   h.label as parent_hive_label, h.public_id as parent_hive_public_id,
                   u.name as created_by_name,
                   qr.name as queen_name
            FROM hive_splits hs
            LEFT JOIN hives h ON hs.parent_hive_id = h.id
            LEFT JOIN users u ON hs.created_by_user_id = u.id
            LEFT JOIN queen_records qr ON hs.queen_id = qr.id
            WHERE hs.org_id = $1
        `;
        const params: any[] = [req.user!.org_id];

        if (parent_hive_id) {
            query += ` AND hs.parent_hive_id = $${params.length + 1}`;
            params.push(parent_hive_id);
        }

        if (start_date) {
            query += ` AND hs.split_date >= $${params.length + 1}`;
            params.push(start_date);
        }

        if (end_date) {
            query += ` AND hs.split_date <= $${params.length + 1}`;
            params.push(end_date);
        }

        query += ' ORDER BY hs.split_date DESC, hs.created_at DESC';

        const result = await pool.query(query, params);

        // Get child hives for each split
        const splits = await Promise.all(
            result.rows.map(async (split: any) => {
                const childHivesResult = await pool.query(
                    `SELECT h.id, h.label, h.public_id, h.status
                     FROM split_hive_relationships shr
                     JOIN hives h ON shr.child_hive_id = h.id
                     WHERE shr.split_id = $1`,
                    [split.id]
                );
                return {
                    ...split,
                    child_hives: childHivesResult.rows
                };
            })
        );

        res.json({ splits });
    } catch (error) {
        next(error);
    }
});

// Get split by ID
splitsRouter.get('/:id', async (req: AuthRequest, res, next) => {
    try {
        const result = await pool.query(
            `SELECT hs.*, 
                    h.label as parent_hive_label, h.public_id as parent_hive_public_id,
                    u.name as created_by_name,
                    qr.name as queen_name
             FROM hive_splits hs
             LEFT JOIN hives h ON hs.parent_hive_id = h.id
             LEFT JOIN users u ON hs.created_by_user_id = u.id
             LEFT JOIN queen_records qr ON hs.queen_id = qr.id
             WHERE hs.id = $1 AND hs.org_id = $2`,
            [req.params.id, req.user!.org_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Split not found' });
        }

        const split = result.rows[0];

        // Get child hives
        const childHivesResult = await pool.query(
            `SELECT h.id, h.label, h.public_id, h.status, h.apiary_id, a.name as apiary_name
             FROM split_hive_relationships shr
             JOIN hives h ON shr.child_hive_id = h.id
             LEFT JOIN apiaries a ON h.apiary_id = a.id
             WHERE shr.split_id = $1`,
            [split.id]
        );

        res.json({
            split: {
                ...split,
                child_hives: childHivesResult.rows
            }
        });
    } catch (error) {
        next(error);
    }
});

// Get splits for a parent hive
splitsRouter.get('/parent/:hiveId', async (req: AuthRequest, res, next) => {
    try {
        const result = await pool.query(
            `SELECT hs.*, 
                    u.name as created_by_name,
                    qr.name as queen_name
             FROM hive_splits hs
             LEFT JOIN users u ON hs.created_by_user_id = u.id
             LEFT JOIN queen_records qr ON hs.queen_id = qr.id
             WHERE hs.parent_hive_id = $1 AND hs.org_id = $2
             ORDER BY hs.split_date DESC`,
            [req.params.hiveId, req.user!.org_id]
        );

        // Get child hives for each split
        const splits = await Promise.all(
            result.rows.map(async (split: any) => {
                const childHivesResult = await pool.query(
                    `SELECT h.id, h.label, h.public_id, h.status
                     FROM split_hive_relationships shr
                     JOIN hives h ON shr.child_hive_id = h.id
                     WHERE shr.split_id = $1`,
                    [split.id]
                );
                return {
                    ...split,
                    child_hives: childHivesResult.rows
                };
            })
        );

        res.json({ splits });
    } catch (error) {
        next(error);
    }
});

// Get split that created a child hive
splitsRouter.get('/child/:hiveId', async (req: AuthRequest, res, next) => {
    try {
        const result = await pool.query(
            `SELECT hs.*, 
                    h.label as parent_hive_label, h.public_id as parent_hive_public_id,
                    u.name as created_by_name,
                    qr.name as queen_name
             FROM split_hive_relationships shr
             JOIN hive_splits hs ON shr.split_id = hs.id
             LEFT JOIN hives h ON hs.parent_hive_id = h.id
             LEFT JOIN users u ON hs.created_by_user_id = u.id
             LEFT JOIN queen_records qr ON hs.queen_id = qr.id
             WHERE shr.child_hive_id = $1 AND hs.org_id = $2`,
            [req.params.hiveId, req.user!.org_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No split found for this hive' });
        }

        res.json({ split: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

// Create split
splitsRouter.post('/', async (req: AuthRequest, res, next) => {
    try {
        if (!['admin', 'manager', 'inspector'].includes(req.user!.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const data = CreateHiveSplitSchema.parse(req.body);

        // Start transaction
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Create the split
            const splitResult = await client.query(
                `INSERT INTO hive_splits (
                    org_id, parent_hive_id, split_date, split_method, frames_moved,
                    brood_frames, honey_frames, pollen_frames, queen_source, queen_id,
                    notes, created_by_user_id
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING *`,
                [
                    req.user!.org_id,
                    data.parent_hive_id,
                    data.split_date,
                    data.split_method || 'walk_away',
                    data.frames_moved || 0,
                    data.brood_frames || 0,
                    data.honey_frames || 0,
                    data.pollen_frames || 0,
                    data.queen_source || null,
                    data.queen_id || null,
                    data.notes || null,
                    req.user!.id
                ]
            );

            const split = splitResult.rows[0];

            // If child hives are provided, create relationships
            if (data.child_hive_ids && data.child_hive_ids.length > 0) {
                for (const childHiveId of data.child_hive_ids) {
                    // Verify child hive belongs to org
                    const hiveCheck = await client.query(
                        'SELECT id FROM hives WHERE id = $1 AND org_id = $2',
                        [childHiveId, req.user!.org_id]
                    );

                    if (hiveCheck.rows.length === 0) {
                        throw new Error(`Hive ${childHiveId} not found or access denied`);
                    }

                    // Create relationship
                    await client.query(
                        `INSERT INTO split_hive_relationships (split_id, child_hive_id)
                         VALUES ($1, $2)`,
                        [split.id, childHiveId]
                    );

                    // Update hive to reference split
                    await client.query(
                        'UPDATE hives SET split_id = $1 WHERE id = $2',
                        [split.id, childHiveId]
                    );
                }
            }

            await client.query('COMMIT');

            // Get child hives for response
            const childHivesResult = await pool.query(
                `SELECT h.id, h.label, h.public_id, h.status
                 FROM split_hive_relationships shr
                 JOIN hives h ON shr.child_hive_id = h.id
                 WHERE shr.split_id = $1`,
                [split.id]
            );

            await logActivity(
                req.user!.org_id,
                req.user!.id,
                'create_hive_split',
                'hive_split',
                split.id,
                { parent_hive_id: split.parent_hive_id, split_date: split.split_date }
            );

            res.status(201).json({
                split: {
                    ...split,
                    child_hives: childHivesResult.rows
                }
            });
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

// Update split
splitsRouter.patch('/:id', async (req: AuthRequest, res, next) => {
    try {
        const data = UpdateHiveSplitSchema.parse(req.body);

        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (data.split_date !== undefined) {
            updates.push(`split_date = $${paramIndex++}`);
            values.push(data.split_date);
        }
        if (data.split_method !== undefined) {
            updates.push(`split_method = $${paramIndex++}`);
            values.push(data.split_method);
        }
        if (data.frames_moved !== undefined) {
            updates.push(`frames_moved = $${paramIndex++}`);
            values.push(data.frames_moved);
        }
        if (data.brood_frames !== undefined) {
            updates.push(`brood_frames = $${paramIndex++}`);
            values.push(data.brood_frames);
        }
        if (data.honey_frames !== undefined) {
            updates.push(`honey_frames = $${paramIndex++}`);
            values.push(data.honey_frames);
        }
        if (data.pollen_frames !== undefined) {
            updates.push(`pollen_frames = $${paramIndex++}`);
            values.push(data.pollen_frames);
        }
        if (data.queen_source !== undefined) {
            updates.push(`queen_source = $${paramIndex++}`);
            values.push(data.queen_source || null);
        }
        if (data.queen_id !== undefined) {
            updates.push(`queen_id = $${paramIndex++}`);
            values.push(data.queen_id || null);
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
            `UPDATE hive_splits SET ${updates.join(', ')}
             WHERE id = $${paramIndex++} AND org_id = $${paramIndex++}
             RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Split not found' });
        }

        // Get child hives
        const childHivesResult = await pool.query(
            `SELECT h.id, h.label, h.public_id, h.status
             FROM split_hive_relationships shr
             JOIN hives h ON shr.child_hive_id = h.id
             WHERE shr.split_id = $1`,
            [req.params.id]
        );

        await logActivity(
            req.user!.org_id,
            req.user!.id,
            'update_hive_split',
            'hive_split',
            req.params.id,
            data
        );

        res.json({
            split: {
                ...result.rows[0],
                child_hives: childHivesResult.rows
            }
        });
    } catch (error) {
        next(error);
    }
});

// Delete split
splitsRouter.delete('/:id', async (req: AuthRequest, res, next) => {
    try {
        if (!['admin', 'manager'].includes(req.user!.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const result = await pool.query(
            `DELETE FROM hive_splits
             WHERE id = $1 AND org_id = $2
             RETURNING id`,
            [req.params.id, req.user!.org_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Split not found' });
        }

        await logActivity(
            req.user!.org_id,
            req.user!.id,
            'delete_hive_split',
            'hive_split',
            req.params.id,
            {}
        );

        res.status(204).send();
    } catch (error) {
        next(error);
    }
});
