import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
        org_id: string;
        role: string;
    };
}

export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string; orgId: string; role: string };
        
        // Verify user still exists and get fresh data
        const result = await pool.query(
            'SELECT id, email, org_id, role FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'User not found' });
        }

        const user = result.rows[0];
        req.user = {
            id: user.id,
            email: user.email,
            org_id: user.org_id,
            role: user.role,
        };

        next();
    } catch (error) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
}

export function requireRole(...allowedRoles: string[]) {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        next();
    };
}

export function generateToken(userId: string, email: string, orgId: string, role: string): string {
    return jwt.sign(
        { userId, email, orgId, role },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}
