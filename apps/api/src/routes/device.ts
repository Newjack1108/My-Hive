import express from 'express';
import { pool } from '../db.js';

export const deviceRouter = express.Router();

function requireDeviceKey(req: express.Request, res: express.Response, next: express.NextFunction) {
    const deviceKey = req.header('X-Device-Key');
    const expected = process.env.DEVICE_API_KEY;

    if (!expected) {
        return res.status(503).json({ error: 'Device API not configured' });
    }
    if (!deviceKey || deviceKey !== expected) {
        return res.status(401).json({ error: 'Invalid device key' });
    }
    next();
}

function parseDeviceTimestamp(value: unknown): string | null {
    if (value == null || value === '') {
        return null;
    }
    const parsed = new Date(value as string | number | Date);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function formatReceivedAt(value: unknown): string {
    if (value instanceof Date) {
        return value.toISOString();
    }
    if (typeof value === 'string') {
        return value;
    }
    return new Date().toISOString();
}

deviceRouter.post('/', requireDeviceKey, async (req, res, next) => {
    try {
        const { device_id, device_name, status, timestamp } = req.body;

        if (!device_id) {
            return res.status(400).json({ error: 'device_id is required' });
        }
        if (!status) {
            return res.status(400).json({ error: 'status is required' });
        }

        const deviceTimestamp = parseDeviceTimestamp(timestamp);

        const result = await pool.query(
            `INSERT INTO device_heartbeats
             (device_id, device_name, status, device_timestamp, payload)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, device_id, device_name, status, device_timestamp, received_at`,
            [
                device_id,
                device_name ?? null,
                status,
                deviceTimestamp,
                req.body,
            ]
        );

        const heartbeat = result.rows[0];

        console.log('Device heartbeat saved:', {
            id: heartbeat.id,
            device_id: heartbeat.device_id,
            device_name: heartbeat.device_name,
            status: heartbeat.status,
            device_timestamp: heartbeat.device_timestamp,
        });

        return res.status(201).json({
            ok: true,
            message: 'Heartbeat received',
            id: heartbeat.id,
            received_at: formatReceivedAt(heartbeat.received_at),
        });
    } catch (error: any) {
        console.error('Device heartbeat insert failed:', {
            code: error?.code,
            message: error?.message,
        });
        next(error);
    }
});
