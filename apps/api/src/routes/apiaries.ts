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
        let result;
        try {
            result = await pool.query(
                `SELECT id, name, description, lat, lng, feeding_radius_m, radius_color, created_at
                 FROM apiaries WHERE org_id = $1
                 ORDER BY name`,
                [req.user!.org_id]
            );
        } catch (queryError: any) {
            // If radius_color column doesn't exist, try without it
            const errorMsg = queryError.message || String(queryError);
            if (errorMsg.includes('radius_color')) {
                console.warn('radius_color column not found, using fallback query');
                try {
                    result = await pool.query(
                        `SELECT id, name, description, lat, lng, feeding_radius_m, NULL as radius_color, created_at
                         FROM apiaries WHERE org_id = $1
                         ORDER BY name`,
                        [req.user!.org_id]
                    );
                } catch (fallbackError: any) {
                    // If feeding_radius_m also doesn't exist, try without both
                    if (fallbackError.message?.includes('feeding_radius_m')) {
                        result = await pool.query(
                            `SELECT id, name, description, lat, lng, NULL as feeding_radius_m, NULL as radius_color, created_at
                             FROM apiaries WHERE org_id = $1
                             ORDER BY name`,
                            [req.user!.org_id]
                        );
                    } else {
                        throw fallbackError;
                    }
                }
            } else {
                throw queryError;
            }
        }

        res.json({ apiaries: result.rows });
    } catch (error) {
        next(error);
    }
});

// Get apiary by ID
apiariesRouter.get('/:id', async (req: AuthRequest, res, next) => {
    try {
        let result;
        try {
            result = await pool.query(
                `SELECT id, name, description, lat, lng, feeding_radius_m, radius_color, created_at
                 FROM apiaries WHERE id = $1 AND org_id = $2`,
                [req.params.id, req.user!.org_id]
            );
        } catch (queryError: any) {
            // If radius_color column doesn't exist, try without it
            const errorMsg = queryError.message || String(queryError);
            if (errorMsg.includes('radius_color')) {
                console.warn('radius_color column not found, using fallback query');
                try {
                    result = await pool.query(
                        `SELECT id, name, description, lat, lng, feeding_radius_m, NULL as radius_color, created_at
                         FROM apiaries WHERE id = $1 AND org_id = $2`,
                        [req.params.id, req.user!.org_id]
                    );
                } catch (fallbackError: any) {
                    // If feeding_radius_m also doesn't exist, try without both
                    if (fallbackError.message?.includes('feeding_radius_m')) {
                        result = await pool.query(
                            `SELECT id, name, description, lat, lng, NULL as feeding_radius_m, NULL as radius_color, created_at
                             FROM apiaries WHERE id = $1 AND org_id = $2`,
                            [req.params.id, req.user!.org_id]
                        );
                    } else {
                        throw fallbackError;
                    }
                }
            } else {
                throw queryError;
            }
        }

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
        if (radiusData.success) {
            if (radiusData.data.feeding_radius_m !== undefined) {
                // Only add feeding_radius_m if column exists (will fail gracefully if not)
                updates.push(`feeding_radius_m = $${paramIndex++}`);
                values.push(radiusData.data.feeding_radius_m || null);
            }
            if (radiusData.data.radius_color !== undefined) {
                // Only add radius_color if column exists (will fail gracefully if not)
                updates.push(`radius_color = $${paramIndex++}`);
                values.push(radiusData.data.radius_color || null);
            }
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        values.push(req.params.id, req.user!.org_id);

        let result;
        try {
            result = await pool.query(
                `UPDATE apiaries SET ${updates.join(', ')}
                 WHERE id = $${paramIndex++} AND org_id = $${paramIndex++}
                 RETURNING id, name, description, lat, lng, feeding_radius_m, radius_color, created_at`,
                values
            );
        } catch (queryError: any) {
            // If radius_color column doesn't exist, remove it from updates and retry
            const errorMsg = queryError.message || String(queryError);
            // If radius_color or feeding_radius_m column doesn't exist, try with fallback RETURNING clause
            if (errorMsg.includes('radius_color') || errorMsg.includes('feeding_radius_m')) {
                console.warn('Optional column not found, using fallback RETURNING clause');
                // Just retry with a simpler RETURNING clause - the UPDATE should still work
                try {
                    result = await pool.query(
                        `UPDATE apiaries SET ${updates.join(', ')}
                         WHERE id = $${paramIndex} AND org_id = $${paramIndex + 1}
                         RETURNING id, name, description, lat, lng, 
                         COALESCE(feeding_radius_m, NULL) as feeding_radius_m, 
                         COALESCE(radius_color, NULL) as radius_color, 
                         created_at`,
                        values
                    );
                } catch (retryError: any) {
                    // If UPDATE itself fails due to missing column, try without that column in UPDATE
                    const retryMsg = retryError.message || String(retryError);
                    if (retryMsg.includes('radius_color') && updates.some(u => u.includes('radius_color'))) {
                        // Remove radius_color from updates
                        const filteredUpdates = updates.filter(u => !u.includes('radius_color'));
                        const filteredValues = values.slice(0, -2); // Remove last 2 (id and org_id)
                        // Remove the value for radius_color
                        let radiusColorIdx = -1;
                        updates.forEach((u, idx) => {
                            if (u.includes('radius_color')) {
                                radiusColorIdx = idx;
                            }
                        });
                        if (radiusColorIdx >= 0) {
                            filteredValues.splice(radiusColorIdx, 1);
                        }
                        filteredValues.push(req.params.id, req.user!.org_id);
                        
                        // Rebuild updates with correct param indices
                        const rebuiltUpdates: string[] = [];
                        filteredUpdates.forEach((u, idx) => {
                            const colName = u.split('=')[0].trim();
                            rebuiltUpdates.push(`${colName} = $${idx + 1}`);
                        });
                        const whereParam1 = rebuiltUpdates.length + 1;
                        const whereParam2 = rebuiltUpdates.length + 2;
                        
                        result = await pool.query(
                            `UPDATE apiaries SET ${rebuiltUpdates.join(', ')}
                             WHERE id = $${whereParam1} AND org_id = $${whereParam2}
                             RETURNING id, name, description, lat, lng, NULL as feeding_radius_m, NULL as radius_color, created_at`,
                            filteredValues
                        );
                    } else if (retryMsg.includes('feeding_radius_m') && updates.some(u => u.includes('feeding_radius_m'))) {
                        // Similar handling for feeding_radius_m
                        const filteredUpdates = updates.filter(u => !u.includes('feeding_radius_m'));
                        const filteredValues = values.slice(0, -2);
                        let feedingRadiusIdx = -1;
                        updates.forEach((u, idx) => {
                            if (u.includes('feeding_radius_m')) {
                                feedingRadiusIdx = idx;
                            }
                        });
                        if (feedingRadiusIdx >= 0) {
                            filteredValues.splice(feedingRadiusIdx, 1);
                        }
                        filteredValues.push(req.params.id, req.user!.org_id);
                        
                        const rebuiltUpdates: string[] = [];
                        filteredUpdates.forEach((u, idx) => {
                            const colName = u.split('=')[0].trim();
                            rebuiltUpdates.push(`${colName} = $${idx + 1}`);
                        });
                        const whereParam1 = rebuiltUpdates.length + 1;
                        const whereParam2 = rebuiltUpdates.length + 2;
                        
                        result = await pool.query(
                            `UPDATE apiaries SET ${rebuiltUpdates.join(', ')}
                             WHERE id = $${whereParam1} AND org_id = $${whereParam2}
                             RETURNING id, name, description, lat, lng, NULL as feeding_radius_m, NULL as radius_color, created_at`,
                            filteredValues
                        );
                    } else {
                        throw retryError;
                    }
                }
            } else {
                throw queryError;
            }
        }

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
