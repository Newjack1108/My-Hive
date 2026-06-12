import express from 'express';

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

deviceRouter.post('/', requireDeviceKey, async (req, res, next) => {
    try {
        const { device_id, device_name, status, timestamp } = req.body;

        console.log('Device heartbeat:', {
            device_id,
            device_name,
            status,
            timestamp,
        });

        res.json({
            ok: true,
            message: 'Heartbeat received',
            received_at: new Date().toISOString(),
        });
    } catch (error) {
        next(error);
    }
});
