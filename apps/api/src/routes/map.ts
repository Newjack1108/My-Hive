import express from 'express';
import { pool } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

export const mapRouter = express.Router();

mapRouter.use(authenticateToken);

// Get all apiaries with coordinates and feeding radii for map
mapRouter.get('/apiaries/map', async (req: AuthRequest, res, next) => {
    try {
        // Check if feeding_radius_m column exists
        const columnCheck = await pool.query(
            `SELECT column_name 
             FROM information_schema.columns 
             WHERE table_name = 'apiaries' AND column_name = 'feeding_radius_m'`
        );
        
        const hasFeedingRadius = columnCheck.rows.length > 0;
        
        const query = hasFeedingRadius
            ? `SELECT id, name, description, lat, lng, feeding_radius_m, created_at
               FROM apiaries
               WHERE org_id = $1 AND lat IS NOT NULL AND lng IS NOT NULL
               ORDER BY name`
            : `SELECT id, name, description, lat, lng, NULL as feeding_radius_m, created_at
               FROM apiaries
               WHERE org_id = $1 AND lat IS NOT NULL AND lng IS NOT NULL
               ORDER BY name`;
        
        const result = await pool.query(query, [req.user!.org_id]);
        res.json({ apiaries: result.rows });
    } catch (error) {
        console.error('Error in /apiaries/map:', error);
        next(error);
    }
});

// Calculate overlapping feeding areas
mapRouter.get('/apiaries/overlaps', async (req: AuthRequest, res, next) => {
    try {
        // Check if feeding_radius_m column exists
        const columnCheck = await pool.query(
            `SELECT column_name 
             FROM information_schema.columns 
             WHERE table_name = 'apiaries' AND column_name = 'feeding_radius_m'`
        );
        
        const hasFeedingRadius = columnCheck.rows.length > 0;
        
        if (!hasFeedingRadius) {
            return res.json({ overlaps: [], message: 'Feeding radius feature not available - migration may not have completed' });
        }
        
        // Get all apiaries with coordinates and radii
        const apiariesResult = await pool.query(
            `SELECT id, name, lat, lng, feeding_radius_m
             FROM apiaries
             WHERE org_id = $1 AND lat IS NOT NULL AND lng IS NOT NULL AND feeding_radius_m IS NOT NULL`,
            [req.user!.org_id]
        );

        const apiaries = apiariesResult.rows;
        const overlaps: any[] = [];

        // Check each pair of apiaries for overlaps
        for (let i = 0; i < apiaries.length; i++) {
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
                    // If PostGIS is not available, skip spatial calculations
                    if (pgError.message && pgError.message.includes('function') && pgError.message.includes('does not exist')) {
                        console.warn('PostGIS functions not available, skipping overlap calculation');
                        continue;
                    }
                    throw pgError;
                }
            }
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

        // Check if feeding_radius_m column exists
        const columnCheck = await pool.query(
            `SELECT column_name 
             FROM information_schema.columns 
             WHERE table_name = 'apiaries' AND column_name = 'feeding_radius_m'`
        );
        
        const hasFeedingRadius = columnCheck.rows.length > 0;
        
        // Get the target apiary
        const targetQuery = hasFeedingRadius
            ? `SELECT id, name, lat, lng, feeding_radius_m
               FROM apiaries
               WHERE id = $1 AND org_id = $2 AND lat IS NOT NULL AND lng IS NOT NULL`
            : `SELECT id, name, lat, lng, NULL as feeding_radius_m
               FROM apiaries
               WHERE id = $1 AND org_id = $2 AND lat IS NOT NULL AND lng IS NOT NULL`;
        
        const targetResult = await pool.query(targetQuery, [id, req.user!.org_id]);

        if (targetResult.rows.length === 0) {
            return res.status(404).json({ error: 'Apiary not found or has no coordinates' });
        }

        const target = targetResult.rows[0];

        // Find nearby apiaries within radius
        let neighborsResult;
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
            // If PostGIS is not available, use simple distance calculation
            if (pgError.message && pgError.message.includes('function') && pgError.message.includes('does not exist')) {
                console.warn('PostGIS not available, using simple distance calculation');
                // Fallback: return all apiaries (distance calculation would be done client-side)
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
