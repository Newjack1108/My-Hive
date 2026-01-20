import express from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { generateToken } from '../middleware/auth.js';
import { LoginSchema } from '@my-hive/shared';
import { logActivity } from '../utils/activity.js';

export const authRouter = express.Router();

// One-time seed endpoint (remove after first use for security)
authRouter.post('/seed', async (req, res, next) => {
    try {
        // Check if any users exist
        const userCheck = await pool.query('SELECT COUNT(*) as count FROM users');
        if (parseInt(userCheck.rows[0].count) > 0) {
            return res.status(400).json({ error: 'Database already seeded' });
        }

        // Create sample organisation
        const orgResult = await pool.query(
            `INSERT INTO organisations (name) 
             VALUES ('Sample Apiary Co.') 
             ON CONFLICT DO NOTHING
             RETURNING id`
        );
        
        let orgId;
        if (orgResult.rows.length > 0) {
            orgId = orgResult.rows[0].id;
        } else {
            const existing = await pool.query('SELECT id FROM organisations LIMIT 1');
            orgId = existing.rows[0].id;
        }

        // Create admin user (password: admin123)
        const adminHash = await bcrypt.hash('admin123', 10);
        const adminResult = await pool.query(
            `INSERT INTO users (org_id, email, name, role, password_hash) 
             VALUES ($1, 'admin@example.com', 'Admin User', 'admin', $2)
             ON CONFLICT (email) DO NOTHING
             RETURNING id`,
            [orgId, adminHash]
        );

        // Create apiary
        const apiaryResult = await pool.query(
            `INSERT INTO apiaries (org_id, name, description, lat, lng) 
             VALUES ($1, 'Main Apiary', 'Primary location for beekeeping operations', 37.7749, -122.4194)
             RETURNING id`,
            [orgId]
        );
        const apiaryId = apiaryResult.rows[0].id;

        // Create sample hives
        for (let i = 1; i <= 5; i++) {
            const publicId = `HIVE-${String(i).padStart(3, '0')}`;
            await pool.query(
                `INSERT INTO hives (org_id, apiary_id, public_id, label, status) 
                 VALUES ($1, $2, $3, $4, 'active')
                 ON CONFLICT (public_id) DO NOTHING`,
                [orgId, apiaryId, publicId, `Hive ${i}`]
            );
        }

        // Create inspector user (password: inspector123)
        const inspectorHash = await bcrypt.hash('inspector123', 10);
        await pool.query(
            `INSERT INTO users (org_id, email, name, role, password_hash) 
             VALUES ($1, 'inspector@example.com', 'Inspector User', 'inspector', $2)
             ON CONFLICT (email) DO NOTHING`,
            [orgId, inspectorHash]
        );

        res.json({ 
            message: 'Database seeded successfully', 
            credentials: {
                admin: 'admin@example.com / admin123',
                inspector: 'inspector@example.com / inspector123'
            }
        });
    } catch (error) {
        next(error);
    }
});

// Login
authRouter.post('/login', async (req, res, next) => {
    try {
        const { email, password } = LoginSchema.parse(req.body);

        const result = await pool.query(
            'SELECT id, email, name, org_id, role, password_hash FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];

        if (!user.password_hash) {
            return res.status(401).json({ error: 'Password authentication not available' });
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update last login
        await pool.query(
            'UPDATE users SET last_login_at = NOW() WHERE id = $1',
            [user.id]
        );

        const token = generateToken(user.id, user.email, user.org_id, user.role);

        // Log activity
        await logActivity(user.org_id, user.id, 'login', null, null, {});

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                org_id: user.org_id,
                role: user.role,
            },
        });
    } catch (error) {
        next(error);
    }
});

// Get current user
authRouter.get('/me', async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const jwt = await import('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
        const decoded = jwt.default.verify(token, JWT_SECRET) as { userId: string };

        const result = await pool.query(
            'SELECT id, email, name, org_id, role FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'User not found' });
        }

        res.json({ user: result.rows[0] });
    } catch (error) {
        next(error);
    }
});
