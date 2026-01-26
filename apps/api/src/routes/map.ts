import express from 'express';
import { pool } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

export const mapRouter = express.Router();

mapRouter.use(authenticateToken);

// Get all apiaries with coordinates and feeding radii for map
mapRouter.get('/apiaries/map', async (req: AuthRequest, res, next) => {
    try {
        // Try query with all columns first, fallback if columns don't exist
        let result;
        try {
            result = await pool.query(
                `SELECT id, name, description, lat, lng, feeding_radius_m, radius_color, created_at
                 FROM apiaries
                 WHERE org_id = $1 AND lat IS NOT NULL AND lng IS NOT NULL
                 ORDER BY name`,
                [req.user!.org_id]
            );
        } catch (queryError: any) {
            // If query fails (likely column doesn't exist), try without optional columns
            const errorMsg = queryError.message || String(queryError);
            console.warn('Query with all columns failed, trying fallback:', errorMsg);
            
            try {
                // Try without radius_color
                result = await pool.query(
                    `SELECT id, name, description, lat, lng, feeding_radius_m, NULL as radius_color, created_at
                     FROM apiaries
                     WHERE org_id = $1 AND lat IS NOT NULL AND lng IS NOT NULL
                     ORDER BY name`,
                    [req.user!.org_id]
                );
            } catch (fallbackError: any) {
                // If that fails, try without both optional columns
                const fallbackMsg = fallbackError.message || String(fallbackError);
                console.warn('Fallback query failed, trying minimal columns:', fallbackMsg);
                try {
                    result = await pool.query(
                        `SELECT id, name, description, lat, lng, NULL as feeding_radius_m, NULL as radius_color, created_at
                         FROM apiaries
                         WHERE org_id = $1 AND lat IS NOT NULL AND lng IS NOT NULL
                         ORDER BY name`,
                        [req.user!.org_id]
                    );
                } catch (finalError: any) {
                    console.error('All fallback queries failed:', finalError);
                    throw finalError;
                }
            }
        }
        
        console.log(`Found ${result.rows.length} apiaries with coordinates for org ${req.user!.org_id}`);
        res.json({ apiaries: result.rows });
    } catch (error: any) {
        console.error('Error in /apiaries/map:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            detail: error.detail
        });
        res.status(500).json({ 
            error: 'Failed to load apiaries for map',
            message: error.message || 'Unknown error'
        });
    }
});

// Calculate overlapping feeding areas
mapRouter.get('/apiaries/overlaps', async (req: AuthRequest, res, next) => {
    try {
        // Try to get apiaries with feeding_radius_m
        let apiariesResult;
        try {
            apiariesResult = await pool.query(
                `SELECT id, name, lat, lng, feeding_radius_m
                 FROM apiaries
                 WHERE org_id = $1 AND lat IS NOT NULL AND lng IS NOT NULL AND feeding_radius_m IS NOT NULL`,
                [req.user!.org_id]
            );
        } catch (colError: any) {
            // If column doesn't exist, return empty overlaps
            if (colError.message && colError.message.includes('column') && colError.message.includes('feeding_radius_m')) {
                return res.json({ overlaps: [], message: 'Feeding radius feature not available - migration may not have completed' });
            }
            throw colError;
        }

        const apiaries = apiariesResult.rows;
        
        // Limit to prevent connection pool exhaustion
        // With N apiaries, we check N*(N-1)/2 pairs - limit to 50 apiaries max (1,225 queries)
        const MAX_APIARIES = 50;
        if (apiaries.length > MAX_APIARIES) {
            console.warn(`Too many apiaries (${apiaries.length}), limiting overlap check to first ${MAX_APIARIES}`);
            apiaries.splice(MAX_APIARIES);
        }
        
        const overlaps: any[] = [];

        // Check each pair of apiaries for overlaps
        let postgisErrorOccurred = false;
        outerLoop: for (let i = 0; i < apiaries.length; i++) {
            for (let j = i + 1; j < apiaries.length; j++) {
                const apiary1 = apiaries[i];
                const apiary2 = apiaries[j];

                try {
                    // Calculate distance between apiaries using PostGIS
                    const distanceResult = await pool.query(
                        `SELECT ST_Distance(
                            ST_MakePoint($1, $2)::geography,
                            ST_MakePoint($3, $4)::geography
                        ) AS distance`,
                        [apiary1.lng, apiary1.lat, apiary2.lng, apiary2.lat]
                    );

                    const distanceMeters = parseFloat(distanceResult.rows[0].distance);
                    const combinedRadius = (parseFloat(apiary1.feeding_radius_m) || 0) + (parseFloat(apiary2.feeding_radius_m) || 0);

                    if (distanceMeters < combinedRadius) {
                        // Calculate overlap area
                        const overlapResult = await pool.query(
                            `SELECT ST_Area(
                                ST_Intersection(
                                    ST_Buffer(ST_MakePoint($1, $2)::geography, $3),
                                    ST_Buffer(ST_MakePoint($4, $5)::geography, $6)
                                )
                            ) AS overlap_area`,
                            [
                                apiary1.lng, apiary1.lat, apiary1.feeding_radius_m,
                                apiary2.lng, apiary2.lat, apiary2.feeding_radius_m
                            ]
                        );

                        overlaps.push({
                            apiary1: {
                                id: apiary1.id,
                                name: apiary1.name,
                                lat: apiary1.lat,
                                lng: apiary1.lng,
                                radius_m: apiary1.feeding_radius_m
                            },
                            apiary2: {
                                id: apiary2.id,
                                name: apiary2.name,
                                lat: apiary2.lat,
                                lng: apiary2.lng,
                                radius_m: apiary2.feeding_radius_m
                            },
                            distance_meters: distanceMeters,
                            overlap_area_sq_meters: parseFloat(overlapResult.rows[0].overlap_area) || 0
                        });
                    }
                } catch (pgError: any) {
                    // If PostGIS is not available (function, type, or extension errors), skip spatial calculations
                    const errorMsg = pgError.message || String(pgError);
                    if (errorMsg.includes('does not exist') || 
                        errorMsg.includes('geography') || 
                        errorMsg.includes('PostGIS') ||
                        pgError.code === '42704') { // Type does not exist error code
                        console.warn('PostGIS not available, skipping overlap calculation:', errorMsg);
                        if (!postgisErrorOccurred) {
                            postgisErrorOccurred = true;
                            // Break out of both loops since PostGIS is not available
                            break outerLoop;
                        }
                        continue;
                    }
                    throw pgError;
                }
            }
        }

        // If PostGIS error occurred, return early with empty overlaps
        if (postgisErrorOccurred) {
            return res.json({ overlaps: [], message: 'PostGIS not available - overlap calculations require PostGIS extension' });
        }

        res.json({ overlaps });
    } catch (error) {
        next(error);
    }
});

// Find nearby apiaries within radius
mapRouter.get('/apiaries/:id/neighbors', async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;
        const radiusMeters = parseInt(req.query.radius as string) || 5000; // Default 5km

        // Get the target apiary - try with feeding_radius_m, fallback if column doesn't exist
        let targetResult;
        try {
            targetResult = await pool.query(
                `SELECT id, name, lat, lng, feeding_radius_m
                 FROM apiaries
                 WHERE id = $1 AND org_id = $2 AND lat IS NOT NULL AND lng IS NOT NULL`,
                [id, req.user!.org_id]
            );
        } catch (colError: any) {
            // If column doesn't exist, query without it
            if (colError.message && colError.message.includes('column') && colError.message.includes('feeding_radius_m')) {
                targetResult = await pool.query(
                    `SELECT id, name, lat, lng, NULL as feeding_radius_m
                     FROM apiaries
                     WHERE id = $1 AND org_id = $2 AND lat IS NOT NULL AND lng IS NOT NULL`,
                    [id, req.user!.org_id]
                );
            } else {
                throw colError;
            }
        }

        if (targetResult.rows.length === 0) {
            return res.status(404).json({ error: 'Apiary not found or has no coordinates' });
        }

        const target = targetResult.rows[0];

        // Find nearby apiaries within radius
        let neighborsResult;
        const hasFeedingRadius = target.feeding_radius_m !== null && target.feeding_radius_m !== undefined;
        const neighborsBaseQuery = hasFeedingRadius
            ? `SELECT id, name, lat, lng, feeding_radius_m`
            : `SELECT id, name, lat, lng, NULL as feeding_radius_m`;
        
        try {
            neighborsResult = await pool.query(
                `${neighborsBaseQuery},
                        ST_Distance(
                            ST_MakePoint($1, $2)::geography,
                            ST_MakePoint(lng, lat)::geography
                        ) AS distance_meters
                 FROM apiaries
                 WHERE org_id = $3
                   AND id != $4
                   AND lat IS NOT NULL
                   AND lng IS NOT NULL
                   AND ST_DWithin(
                       ST_MakePoint($1, $2)::geography,
                       ST_MakePoint(lng, lat)::geography,
                       $5
                   )
                 ORDER BY distance_meters`,
                [target.lng, target.lat, req.user!.org_id, id, radiusMeters]
            );
        } catch (pgError: any) {
            // If PostGIS is not available or column doesn't exist, use simple query
            const errorMsg = pgError.message || String(pgError);
            if (errorMsg.includes('does not exist') || 
                errorMsg.includes('geography') || 
                errorMsg.includes('PostGIS') ||
                errorMsg.includes('column') && errorMsg.includes('feeding_radius_m') ||
                pgError.code === '42704') { // Type does not exist error code
                console.warn('PostGIS not available or column missing, using simple query:', errorMsg);
                // Fallback: return all apiaries (distance calculation would be done client-side)
                try {
                    neighborsResult = await pool.query(
                        `${neighborsBaseQuery},
                                NULL AS distance_meters
                         FROM apiaries
                         WHERE org_id = $1
                           AND id != $2
                           AND lat IS NOT NULL
                           AND lng IS NOT NULL
                         LIMIT 50`,
                        [req.user!.org_id, id]
                    );
                } catch (fallbackError: any) {
                    // If feeding_radius_m column doesn't exist in fallback, query without it
                    if (fallbackError.message && fallbackError.message.includes('column') && fallbackError.message.includes('feeding_radius_m')) {
                        neighborsResult = await pool.query(
                            `SELECT id, name, lat, lng, NULL as feeding_radius_m,
                                    NULL AS distance_meters
                             FROM apiaries
                             WHERE org_id = $1
                               AND id != $2
                               AND lat IS NOT NULL
                               AND lng IS NOT NULL
                             LIMIT 50`,
                            [req.user!.org_id, id]
                        );
                    } else {
                        throw fallbackError;
                    }
                }
            } else {
                throw pgError;
            }
        }

        res.json({
            target: {
                id: target.id,
                name: target.name,
                lat: target.lat,
                lng: target.lng,
                radius_m: target.feeding_radius_m
            },
            neighbors: neighborsResult.rows,
            search_radius_meters: radiusMeters
        });
    } catch (error) {
        next(error);
    }
});
