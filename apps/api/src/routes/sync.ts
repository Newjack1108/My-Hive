import express from 'express';
import { pool } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { logActivity } from '../utils/activity.js';

export const syncRouter = express.Router();

syncRouter.use(authenticateToken);

// Sync queued items from offline
syncRouter.post('/queue', async (req: AuthRequest, res, next) => {
    try {
        const { items } = req.body; // Array of { entity_type, entity_id?, client_uuid, action, payload_json }

        if (!Array.isArray(items)) {
            return res.status(400).json({ error: 'Items must be an array' });
        }

        const results = [];

        for (const item of items) {
            try {
                // Check if already synced by client_uuid
                let existingId = null;

                if (item.entity_type === 'inspection' && item.client_uuid) {
                    const existing = await pool.query(
                        'SELECT id FROM inspections WHERE client_uuid = $1',
                        [item.client_uuid]
                    );
                    if (existing.rows.length > 0) {
                        existingId = existing.rows[0].id;
                    }
                }

                if (existingId) {
                    results.push({
                        client_uuid: item.client_uuid,
                        status: 'duplicate',
                        server_id: existingId,
                    });
                    continue;
                }

                // Process based on entity_type
                let serverId = null;

                if (item.entity_type === 'inspection' && item.action === 'create') {
                    const payload = item.payload_json;
                    // Fetch weather if location is available (non-blocking)
                    let weatherJson = null;
                    if (payload.location_lat && payload.location_lng) {
                        try {
                            const { getWeatherData } = await import('../utils/weatherService.js');
                            const weatherData = await getWeatherData(
                                payload.location_lat,
                                payload.location_lng,
                                { includeForecast: false }
                            );
                            if (weatherData) {
                                weatherJson = JSON.stringify(weatherData);
                            }
                        } catch (error) {
                            // Don't fail sync if weather fetch fails
                            console.error('Failed to fetch weather during sync:', error);
                        }
                    }

                    const result = await pool.query(
                        `INSERT INTO inspections (
                            org_id, hive_id, inspector_user_id, started_at, ended_at,
                            location_lat, location_lng, location_accuracy_m,
                            offline_created_at, client_uuid, sections_json, notes, weather_json
                        )
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                        RETURNING id`,
                        [
                            req.user!.org_id,
                            payload.hive_id,
                            req.user!.id,
                            payload.started_at,
                            payload.ended_at || null,
                            payload.location_lat || null,
                            payload.location_lng || null,
                            payload.location_accuracy_m || null,
                            payload.offline_created_at || null,
                            item.client_uuid,
                            payload.sections_json ? JSON.stringify(payload.sections_json) : null,
                            payload.notes || null,
                            weatherJson,
                        ]
                    );

                    serverId = result.rows[0].id;

                    if (payload.ended_at) {
                        await pool.query('UPDATE inspections SET locked_at = NOW() WHERE id = $1', [serverId]);
                        
                        // Auto-complete related 'inspection_due' tasks when inspection is synced
                        if (payload.hive_id) {
                            try {
                                const tasksResult = await pool.query(
                                    `UPDATE tasks
                                     SET status = 'completed',
                                         completed_at = NOW(),
                                         inspection_id = $1
                                     WHERE org_id = $2
                                       AND hive_id = $3
                                       AND type = 'inspection_due'
                                       AND status = 'pending'
                                       AND (inspection_id IS NULL OR inspection_id != $1)
                                     RETURNING id`,
                                    [serverId, req.user!.org_id, payload.hive_id]
                                );

                                if (tasksResult.rows.length > 0) {
                                    console.log(`[Sync] Auto-completed ${tasksResult.rows.length} inspection_due task(s) for hive ${payload.hive_id}`);
                                }
                            } catch (error) {
                                // Don't fail sync if task completion fails
                                console.error('Failed to auto-complete inspection_due tasks during sync:', error);
                            }
                        }
                    }

                    await logActivity(
                        req.user!.org_id,
                        req.user!.id,
                        'sync_inspection',
                        'inspection',
                        serverId,
                        { client_uuid: item.client_uuid }
                    );
                }

                results.push({
                    client_uuid: item.client_uuid,
                    status: 'synced',
                    server_id: serverId,
                });
            } catch (error: any) {
                results.push({
                    client_uuid: item.client_uuid,
                    status: 'failed',
                    error: error.message,
                });
            }
        }

        res.json({ results });
    } catch (error) {
        next(error);
    }
});
