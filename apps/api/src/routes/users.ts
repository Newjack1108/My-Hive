import express from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.js';
import { CreateUserSchema } from '@my-hive/shared';
import { logActivity } from '../utils/activity.js';
import { v4 as uuidv4 } from 'uuid';

export const usersRouter = express.Router();

// All routes require authentication
usersRouter.use(authenticateToken);

// List users in org
usersRouter.get('/', async (req: AuthRequest, res, next) => {
    try {
        const result = await pool.query(
            `SELECT id, email, name, role, created_at, last_login_at
             FROM users WHERE org_id = $1
             ORDER BY created_at DESC`,
            [req.user!.org_id]
        );

        res.json({ users: result.rows });
    } catch (error) {
        next(error);
    }
});

// Get user by ID
usersRouter.get('/:id', async (req: AuthRequest, res, next) => {
    try {
        const result = await pool.query(
            `SELECT id, email, name, role, created_at, last_login_at
             FROM users WHERE id = $1 AND org_id = $2`,
            [req.params.id, req.user!.org_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

// Create user (admin only)
usersRouter.post('/', requireRole('admin'), async (req: AuthRequest, res, next) => {
    try {
        const data = CreateUserSchema.parse(req.body);
        const { email, name, role, password, sendMagicLink } = data;

        // Check if user already exists
        const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'User with this email already exists' });
        }

        let passwordHash = null;
        let authProvider = 'magic_link';

        if (password) {
            passwordHash = await bcrypt.hash(password, 10);
            authProvider = 'password';
        } else if (!sendMagicLink) {
            // Generate temporary password if neither provided
            const tempPassword = uuidv4().substring(0, 12);
            passwordHash = await bcrypt.hash(tempPassword, 10);
            authProvider = 'password';
            // In production, send email with temp password
            console.log(`Temporary password for ${email}: ${tempPassword}`);
        }

        const result = await pool.query(
            `INSERT INTO users (org_id, email, name, role, password_hash, auth_provider)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, email, name, role, created_at`,
            [req.user!.org_id, email, name, role, passwordHash, authProvider]
        );

        const newUser = result.rows[0];

        await logActivity(
            req.user!.org_id,
            req.user!.id,
            'admin_create_user',
            'user',
            newUser.id,
            { email, role }
        );

        res.status(201).json({ user: newUser });
    } catch (error) {
        next(error);
    }
});

// Update user role (admin only)
usersRouter.patch('/:id/role', requireRole('admin'), async (req: AuthRequest, res, next) => {
    try {
        const { role } = req.body;
        if (!['admin', 'manager', 'inspector', 'viewer'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        const result = await pool.query(
            `UPDATE users SET role = $1
             WHERE id = $2 AND org_id = $3
             RETURNING id, email, name, role`,
            [role, req.params.id, req.user!.org_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        await logActivity(
            req.user!.org_id,
            req.user!.id,
            'admin_update_user_role',
            'user',
            req.params.id,
            { role }
        );

        res.json({ user: result.rows[0] });
    } catch (error) {
        next(error);
    }
});
