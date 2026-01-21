import express from 'express';
import { pool } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { CreateInspectionSchema, UpdateInspectionSchema } from '@my-hive/shared';
import { logActivity } from '../utils/activity.js';
import { getWeatherData, getHistoricalWeather } from '../utils/weatherService.js';
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

        const inspection = result.rows[0];

        // Fetch historical weather if not already stored and inspection has location and is in the past
        if (!inspection.weather_json && inspection.location_lat && inspection.location_lng && inspection.started_at) {
            const inspectionDate = new Date(inspection.started_at);
            const now = new Date();
            
            // Only fetch historical weather for past inspections (more than 1 hour ago)
            if (inspectionDate < new Date(now.getTime() - 60 * 60 * 1000)) {
                try {
                    const historicalDate = inspectionDate.toISOString().split('T')[0];
                    const historical = await getHistoricalWeather(
                        parseFloat(inspection.location_lat),
                        parseFloat(inspection.location_lng),
                        historicalDate
                    );
                    
                    if (historical) {
                        // Also get current weather at that time (or use historical as current)
                        const weatherData = {
                            current: {
                                temp: historical.temp,
                                feels_like: historical.temp,
                                humidity: historical.humidity || 0,
                                pressure: historical.pressure || 0,
                                wind_speed: historical.wind_speed || 0,
                                visibility: undefined,
                                conditions: historical.conditions,
                                icon: historical.icon,
                                description: historical.description,
                            },
                            historical,
                            timestamp: inspection.started_at,
                            location: {
                                lat: parseFloat(inspection.location_lat),
                                lng: parseFloat(inspection.location_lng),
                            },
                        };
                        
                        // Update inspection with historical weather (non-blocking)
                        pool.query(
                            'UPDATE inspections SET weather_json = $1 WHERE id = $2',
                            [JSON.stringify(weatherData), req.params.id]
                        ).catch(console.error);
                        
                        inspection.weather_json = JSON.stringify(weatherData);
                    }
                } catch (error) {
                    console.error('Failed to fetch historical weather:', error);
                    // Continue without weather data
                }
            }
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
            inspection,
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

        // Fetch weather if location is available (non-blocking)
        let weatherJson = null;
        if (data.location_lat && data.location_lng) {
            try {
                const weatherData = await getWeatherData(
                    data.location_lat,
                    data.location_lng,
                    { includeForecast: false }
                );
                if (weatherData) {
                    weatherJson = JSON.stringify(weatherData);
                }
            } catch (error) {
                // Don't fail inspection creation if weather fetch fails
                console.error('Failed to fetch weather for inspection:', error);
            }
        }

        const result = await pool.query(
            `INSERT INTO inspections (
                org_id, hive_id, inspector_user_id, started_at, ended_at,
                location_lat, location_lng, location_accuracy_m,
                offline_created_at, client_uuid, sections_json, notes, weather_json
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
                weatherJson,
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

// Manually fetch/update weather for an inspection
inspectionsRouter.post('/:id/weather', async (req: AuthRequest, res, next) => {
    try {
        if (!['admin', 'manager', 'inspector'].includes(req.user!.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        // Get inspection
        const inspectionResult = await pool.query(
            'SELECT location_lat, location_lng, started_at FROM inspections WHERE id = $1 AND org_id = $2',
            [req.params.id, req.user!.org_id]
        );

        if (inspectionResult.rows.length === 0) {
            return res.status(404).json({ error: 'Inspection not found' });
        }

        const inspection = inspectionResult.rows[0];

        if (!inspection.location_lat || !inspection.location_lng) {
            return res.status(400).json({ error: 'Inspection does not have location data' });
        }

        const lat = parseFloat(inspection.location_lat);
        const lng = parseFloat(inspection.location_lng);
        const inspectionDate = new Date(inspection.started_at);
        const now = new Date();
        const isPastInspection = inspectionDate < new Date(now.getTime() - 60 * 60 * 1000);

        let weatherData;
        
        if (isPastInspection) {
            // Fetch historical weather for past inspections
            const historicalDate = inspectionDate.toISOString().split('T')[0];
            const historical = await getHistoricalWeather(lat, lng, historicalDate);
            
            if (!historical) {
                return res.status(503).json({ error: 'Historical weather data not available' });
            }

            weatherData = {
                current: {
                    temp: historical.temp,
                    feels_like: historical.temp,
                    humidity: historical.humidity || 0,
                    pressure: historical.pressure || 0,
                    wind_speed: historical.wind_speed || 0,
                    visibility: undefined,
                    conditions: historical.conditions,
                    icon: historical.icon,
                    description: historical.description,
                },
                historical,
                timestamp: inspection.started_at,
                location: { lat, lng },
            };
        } else {
            // Fetch current weather for recent/current inspections
            const current = await getWeatherData(lat, lng, { includeForecast: false });
            if (!current) {
                return res.status(503).json({ error: 'Weather service unavailable' });
            }
            weatherData = current;
        }

        // Update inspection with weather data
        await pool.query(
            'UPDATE inspections SET weather_json = $1 WHERE id = $2',
            [JSON.stringify(weatherData), req.params.id]
        );

        res.json({ weather: weatherData });
    } catch (error) {
        next(error);
    }
});
