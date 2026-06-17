import express from 'express';
import { pool } from '../db.js';
import { authenticateToken, AuthRequest, requireRole } from '../middleware/auth.js';
import { CreateDeviceSchema, UpdateDeviceSchema } from '@my-hive/shared';

export const devicesRouter = express.Router();

devicesRouter.use(authenticateToken);
devicesRouter.use(requireRole('admin'));

async function verifyHiveInOrg(hiveId: string, orgId: string): Promise<boolean> {
    const result = await pool.query(
        'SELECT id FROM hives WHERE id = $1 AND org_id = $2',
        [hiveId, orgId]
    );
    return result.rows.length > 0;
}

function mapDeviceRow(row: any) {
    return {
        id: row.id,
        org_id: row.org_id,
        device_id: row.device_id,
        device_name: row.device_name,
        hive_id: row.hive_id,
        hive_label: row.hive_label ?? null,
        created_at: row.created_at,
        updated_at: row.updated_at,
        last_seen_at: row.last_seen_at ?? null,
        latest_status: row.latest_status ?? null,
        latest_sensors: row.latest_sensors ?? null,
    };
}

const deviceListBase = `
    SELECT d.*,
           h.label AS hive_label,
           hb.received_at AS last_seen_at,
           hb.status AS latest_status,
           hb.payload->'sensors' AS latest_sensors
    FROM devices d
    LEFT JOIN hives h ON d.hive_id = h.id
    LEFT JOIN LATERAL (
        SELECT received_at, status, payload
        FROM device_heartbeats
        WHERE device_id = d.device_id
        ORDER BY received_at DESC
        LIMIT 1
    ) hb ON true`;

async function fetchDevice(orgId: string, deviceUuid: string) {
    const result = await pool.query(
        `${deviceListBase} WHERE d.org_id = $1 AND d.id = $2`,
        [orgId, deviceUuid]
    );
    return result.rows[0] ? mapDeviceRow(result.rows[0]) : null;
}

// List org devices with latest heartbeat
devicesRouter.get('/', async (req: AuthRequest, res, next) => {
    try {
        const result = await pool.query(
            `${deviceListBase} WHERE d.org_id = $1 ORDER BY d.device_id`,
            [req.user!.org_id]
        );
        res.json({ devices: result.rows.map(mapDeviceRow) });
    } catch (error) {
        next(error);
    }
});

// Device IDs heartbeating but not registered in this org
devicesRouter.get('/discovered', async (req: AuthRequest, res, next) => {
    try {
        const result = await pool.query(
            `SELECT DISTINCT dh.device_id,
                    MAX(dh.received_at) AS last_seen_at,
                    (ARRAY_AGG(dh.device_name ORDER BY dh.received_at DESC))[1] AS device_name
             FROM device_heartbeats dh
             WHERE dh.device_id NOT IN (
                 SELECT device_id FROM devices WHERE org_id = $1
             )
             GROUP BY dh.device_id
             ORDER BY dh.device_id`,
            [req.user!.org_id]
        );
        res.json({ discovered: result.rows });
    } catch (error) {
        next(error);
    }
});

// Register device
devicesRouter.post('/', async (req: AuthRequest, res, next) => {
    try {
        const data = CreateDeviceSchema.parse(req.body);

        if (data.hive_id) {
            const ok = await verifyHiveInOrg(data.hive_id, req.user!.org_id);
            if (!ok) {
                return res.status(400).json({ error: 'Hive not found in your organisation' });
            }
        }

        const result = await pool.query(
            `INSERT INTO devices (org_id, device_id, device_name, hive_id)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [
                req.user!.org_id,
                data.device_id.trim(),
                data.device_name?.trim() || null,
                data.hive_id ?? null,
            ]
        );

        const device = await fetchDevice(req.user!.org_id, result.rows[0].id);
        res.status(201).json({ device });
    } catch (error: any) {
        if (error?.code === '23505') {
            const msg = String(error?.constraint || '').includes('hive')
                ? 'Hive already has a device assigned'
                : 'Device already registered in this organisation';
            return res.status(409).json({ error: msg });
        }
        next(error);
    }
});

// Update device (name / hive assignment)
devicesRouter.patch('/:id', async (req: AuthRequest, res, next) => {
    try {
        const data = UpdateDeviceSchema.parse(req.body);

        if (data.hive_id) {
            const ok = await verifyHiveInOrg(data.hive_id, req.user!.org_id);
            if (!ok) {
                return res.status(400).json({ error: 'Hive not found in your organisation' });
            }
        }

        const updates: string[] = ['updated_at = NOW()'];
        const values: unknown[] = [];
        let paramIndex = 1;

        if (data.device_name !== undefined) {
            updates.push(`device_name = $${paramIndex++}`);
            values.push(data.device_name?.trim() || null);
        }
        if (data.hive_id !== undefined) {
            updates.push(`hive_id = $${paramIndex++}`);
            values.push(data.hive_id ?? null);
        }

        if (updates.length === 1) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        values.push(req.params.id, req.user!.org_id);

        const result = await pool.query(
            `UPDATE devices SET ${updates.join(', ')}
             WHERE id = $${paramIndex++} AND org_id = $${paramIndex++}
             RETURNING id`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Device not found' });
        }

        const device = await fetchDevice(req.user!.org_id, req.params.id);
        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }

        res.json({ device });
    } catch (error: any) {
        if (error?.code === '23505') {
            return res.status(409).json({ error: 'Hive already has a device assigned' });
        }
        next(error);
    }
});

// Remove device registration
devicesRouter.delete('/:id', async (req: AuthRequest, res, next) => {
    try {
        const result = await pool.query(
            'DELETE FROM devices WHERE id = $1 AND org_id = $2 RETURNING id',
            [req.params.id, req.user!.org_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Device not found' });
        }

        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
});
