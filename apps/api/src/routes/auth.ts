import express from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { generateToken } from '../middleware/auth.js';
import { LoginSchema } from '@my-hive/shared';
import { logActivity } from '../utils/activity.js';

export const authRouter = express.Router();

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
