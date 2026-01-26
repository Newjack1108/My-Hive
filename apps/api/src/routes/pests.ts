import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { v2 as cloudinary } from 'cloudinary';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import {
    CreatePestKnowledgeBaseSchema,
    UpdatePestKnowledgeBaseSchema,
    CreatePestTreatmentSchema,
    CreatePestOccurrenceSchema,
    CreateTreatmentEffectivenessSchema
} from '@my-hive/shared';
import { logActivity } from '../utils/activity.js';

// Configure Cloudinary
const CLOUDINARY_URL = process.env.CLOUDINARY_URL?.trim();
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME?.trim();
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY?.trim();
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET?.trim();

if (CLOUDINARY_URL) {
    cloudinary.config({ secure: true });
} else if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
    cloudinary.config({
        cloud_name: CLOUDINARY_CLOUD_NAME,
        api_key: CLOUDINARY_API_KEY,
        api_secret: CLOUDINARY_API_SECRET,
        secure: true,
    });
}

// Configure multer for image uploads
const pestImageUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    },
});

const MAX_IMAGE_DIMENSION = 1600;

// Helper function to process and upload pest image
async function processAndUploadPestImage(buffer: Buffer, pestId: string): Promise<string> {
    let image = sharp(buffer);
    const metadata = await image.metadata();
    const { width, height } = metadata;
    
    if (width && height && (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION)) {
        image = image.resize(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, {
            fit: 'inside',
            withoutEnlargement: true,
        });
    }
    
    const processed = await image.jpeg({ quality: 85, progressive: true }).toBuffer();
    const publicId = `my-hive/pests/${pestId}-${uuidv4()}`;
    
    const result = await new Promise<any>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { public_id: publicId, overwrite: false },
            (err, r) => (err ? reject(err) : resolve(r))
        );
        stream.end(processed);
    });
    
    return cloudinary.url(result.public_id, { secure: true });
}

export const pestsRouter = express.Router();

pestsRouter.use(authenticateToken);

// Knowledge Base - Get all pests (global + org-specific)
pestsRouter.get('/', async (req: AuthRequest, res, next) => {
    try {
        const search = req.query.search as string | undefined;

        let query = `
            SELECT * FROM pest_knowledge_base
            WHERE (org_id = $1 OR is_global = true)
        `;
        const params: any[] = [req.user!.org_id];

        if (search) {
            query += ` AND (name ILIKE $${params.length + 1} OR scientific_name ILIKE $${params.length + 1} OR description ILIKE $${params.length + 1})`;
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern, searchPattern);
        }

        query += ' ORDER BY is_global DESC, name';

        const result = await pool.query(query, params);

        // Parse JSONB fields
        const pests = result.rows.map(pest => ({
            ...pest,
            treatment_options: pest.treatment_options ? (typeof pest.treatment_options === 'string' ? JSON.parse(pest.treatment_options) : pest.treatment_options) : null
        }));

        res.json({ pests });
    } catch (error) {
        next(error);
    }
});

// Get pest by ID
pestsRouter.get('/:id', async (req: AuthRequest, res, next) => {
    try {
        const result = await pool.query(
            `SELECT * FROM pest_knowledge_base
             WHERE id = $1 AND (org_id = $2 OR is_global = true)`,
            [req.params.id, req.user!.org_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Pest not found' });
        }

        const pest = result.rows[0];
        if (pest.treatment_options) {
            pest.treatment_options = typeof pest.treatment_options === 'string' ? JSON.parse(pest.treatment_options) : pest.treatment_options;
        }

        // Get treatments for this pest
        const treatmentsResult = await pool.query(
            `SELECT * FROM pest_treatments
             WHERE pest_id = $1 AND (org_id = $2 OR is_global = true)
             ORDER BY effectiveness_rating DESC NULLS LAST`,
            [req.params.id, req.user!.org_id]
        );

        res.json({
            pest,
            treatments: treatmentsResult.rows
        });
    } catch (error) {
        next(error);
    }
});

// Search pests by symptoms
pestsRouter.get('/search/symptoms', async (req: AuthRequest, res, next) => {
    try {
        const symptoms = req.query.symptoms as string;
        if (!symptoms) {
            return res.status(400).json({ error: 'Symptoms parameter required' });
        }

        const result = await pool.query(
            `SELECT * FROM pest_knowledge_base
             WHERE (org_id = $1 OR is_global = true)
               AND symptoms ILIKE $2
             ORDER BY severity_level DESC, name`,
            [req.user!.org_id, `%${symptoms}%`]
        );

        const pests = result.rows.map(pest => ({
            ...pest,
            treatment_options: pest.treatment_options ? (typeof pest.treatment_options === 'string' ? JSON.parse(pest.treatment_options) : pest.treatment_options) : null
        }));

        res.json({ pests });
    } catch (error) {
        next(error);
    }
});

// Create pest (admin only)
pestsRouter.post('/', async (req: AuthRequest, res, next) => {
    try {
        if (req.user!.role !== 'admin') {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const data = CreatePestKnowledgeBaseSchema.parse(req.body);

        // Only admins can create global pests
        const isGlobal = data.is_global && req.user!.role === 'admin';
        const orgId = isGlobal ? null : req.user!.org_id;

        const result = await pool.query(
            `INSERT INTO pest_knowledge_base (org_id, name, scientific_name, description, symptoms, treatment_options, prevention_methods, severity_level, image_url, is_global)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *`,
            [
                orgId,
                data.name,
                data.scientific_name || null,
                data.description || null,
                data.symptoms || null,
                data.treatment_options ? JSON.stringify(data.treatment_options) : null,
                data.prevention_methods || null,
                data.severity_level || null,
                data.image_url || null,
                isGlobal
            ]
        );

        const pest = result.rows[0];
        if (pest.treatment_options) {
            pest.treatment_options = typeof pest.treatment_options === 'string' ? JSON.parse(pest.treatment_options) : pest.treatment_options;
        }

        await logActivity(
            req.user!.org_id,
            req.user!.id,
            'create_pest',
            'pest_knowledge_base',
            pest.id,
            { pest_id: pest.id, is_global: isGlobal }
        );

        res.status(201).json({ pest });
    } catch (error) {
        next(error);
    }
});

// Update pest (admin only)
pestsRouter.patch('/:id', async (req: AuthRequest, res, next) => {
    try {
        if (req.user!.role !== 'admin') {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        // First, check if pest exists and get its properties
        const pestCheck = await pool.query(
            `SELECT id, org_id, is_global FROM pest_knowledge_base WHERE id = $1`,
            [req.params.id]
        );

        if (pestCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Pest not found' });
        }

        const existingPest = pestCheck.rows[0];

        // Permission check: Only admins can edit pests
        if (existingPest.is_global && req.user!.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can edit global pests' });
        }

        // Admins can edit org-specific pests from their organization
        if (!existingPest.is_global && existingPest.org_id !== req.user!.org_id) {
            return res.status(403).json({ error: 'Cannot edit pests from other organizations' });
        }

        const data = UpdatePestKnowledgeBaseSchema.parse(req.body);

        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (data.name !== undefined) {
            updates.push(`name = $${paramIndex++}`);
            values.push(data.name);
        }
        if (data.scientific_name !== undefined) {
            updates.push(`scientific_name = $${paramIndex++}`);
            values.push(data.scientific_name || null);
        }
        if (data.description !== undefined) {
            updates.push(`description = $${paramIndex++}`);
            values.push(data.description || null);
        }
        if (data.symptoms !== undefined) {
            updates.push(`symptoms = $${paramIndex++}`);
            values.push(data.symptoms || null);
        }
        if (data.treatment_options !== undefined) {
            updates.push(`treatment_options = $${paramIndex++}`);
            values.push(JSON.stringify(data.treatment_options));
        }
        if (data.prevention_methods !== undefined) {
            updates.push(`prevention_methods = $${paramIndex++}`);
            values.push(data.prevention_methods || null);
        }
        if (data.severity_level !== undefined) {
            updates.push(`severity_level = $${paramIndex++}`);
            values.push(data.severity_level || null);
        }
        if (data.image_url !== undefined) {
            updates.push(`image_url = $${paramIndex++}`);
            values.push(data.image_url || null);
        }
        if (data.is_global !== undefined && req.user!.role === 'admin') {
            // Only admins can change is_global flag
            updates.push(`is_global = $${paramIndex++}`);
            values.push(data.is_global);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        values.push(req.params.id);

        // Build WHERE clause based on pest type
        let whereClause = `id = $${paramIndex++}`;
        if (existingPest.is_global) {
            // For global pests, only check ID (admin permission already verified)
            whereClause = `id = $${paramIndex - 1}`;
        } else {
            // For org-specific pests, verify org_id
            values.push(req.user!.org_id);
            whereClause = `id = $${paramIndex - 1} AND org_id = $${paramIndex++}`;
        }

        const result = await pool.query(
            `UPDATE pest_knowledge_base SET ${updates.join(', ')}
             WHERE ${whereClause}
             RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Pest not found' });
        }

        const pest = result.rows[0];
        if (pest.treatment_options) {
            pest.treatment_options = typeof pest.treatment_options === 'string' ? JSON.parse(pest.treatment_options) : pest.treatment_options;
        }

        await logActivity(
            req.user!.org_id,
            req.user!.id,
            'update_pest',
            'pest_knowledge_base',
            pest.id,
            { pest_id: pest.id }
        );

        res.json({ pest });
    } catch (error) {
        next(error);
    }
});

// Upload pest image (admin only)
pestsRouter.post(
    '/:id/image',
    pestImageUpload.single('photo'),
    async (req: AuthRequest, res, next) => {
        try {
            if (req.user!.role !== 'admin') {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }

            if (!req.file) {
                return res.status(400).json({ error: 'No file provided' });
            }

            if (!CLOUDINARY_URL && !(CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET)) {
                return res.status(503).json({
                    error: 'Cloudinary is not configured. Set CLOUDINARY_URL or CLOUDINARY_* environment variables.',
                });
            }

            // Check if pest exists and verify permissions
            const pestCheck = await pool.query(
                `SELECT id, org_id, is_global FROM pest_knowledge_base WHERE id = $1`,
                [req.params.id]
            );

            if (pestCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Pest not found' });
            }

            const existingPest = pestCheck.rows[0];

            // Permission check: Only admins can upload images for pests
            if (existingPest.is_global && req.user!.role !== 'admin') {
                return res.status(403).json({ error: 'Only admins can upload images for global pests' });
            }

            // Admins can upload images for org-specific pests from their organization
            if (!existingPest.is_global && existingPest.org_id !== req.user!.org_id) {
                return res.status(403).json({ error: 'Cannot upload images for pests from other organizations' });
            }

            // Process and upload image
            const imageUrl = await processAndUploadPestImage(req.file.buffer, req.params.id);

            // Update pest with image URL
            const result = await pool.query(
                `UPDATE pest_knowledge_base SET image_url = $1 WHERE id = $2 RETURNING *`,
                [imageUrl, req.params.id]
            );

            await logActivity(
                req.user!.org_id,
                req.user!.id,
                'upload_pest_image',
                'pest_knowledge_base',
                req.params.id,
                { pest_id: req.params.id }
            );

            res.status(201).json({ pest: result.rows[0] });
        } catch (error) {
            next(error);
        }
    }
);

// Delete pest (admin only)
pestsRouter.delete('/:id', async (req: AuthRequest, res, next) => {
    try {
        if (req.user!.role !== 'admin') {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        // First, check if pest exists and get its properties
        const pestCheck = await pool.query(
            `SELECT id, org_id, is_global FROM pest_knowledge_base WHERE id = $1`,
            [req.params.id]
        );

        if (pestCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Pest not found' });
        }

        const existingPest = pestCheck.rows[0];

        // Permission check: Only admins can delete pests
        if (existingPest.is_global && req.user!.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can delete global pests' });
        }

        // Admins can delete org-specific pests from their organization
        if (!existingPest.is_global && existingPest.org_id !== req.user!.org_id) {
            return res.status(403).json({ error: 'Cannot delete pests from other organizations' });
        }

        // Check for existing pest_occurrences (optional safety check)
        const occurrencesCheck = await pool.query(
            `SELECT COUNT(*) as count FROM pest_occurrences WHERE pest_id = $1`,
            [req.params.id]
        );

        const occurrenceCount = parseInt(occurrencesCheck.rows[0].count);
        if (occurrenceCount > 0) {
            // Warn but allow deletion (CASCADE will handle it)
            // Could return error here if you want to prevent deletion with occurrences
        }

        // Delete pest (CASCADE will delete related treatments and occurrences)
        const result = await pool.query(
            `DELETE FROM pest_knowledge_base WHERE id = $1 RETURNING id, name`,
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Pest not found' });
        }

        await logActivity(
            req.user!.org_id,
            req.user!.id,
            'delete_pest',
            'pest_knowledge_base',
            req.params.id,
            { pest_id: req.params.id, pest_name: result.rows[0].name }
        );

        res.json({ message: 'Pest deleted successfully', deletedPest: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

// Treatments (admin only)
pestsRouter.post('/:id/treatments', async (req: AuthRequest, res, next) => {
    try {
        if (req.user!.role !== 'admin') {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const data = CreatePestTreatmentSchema.parse({ ...req.body, pest_id: req.params.id });

        const result = await pool.query(
            `INSERT INTO pest_treatments (org_id, pest_id, treatment_name, treatment_method, products, application_instructions, effectiveness_rating, is_global)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [
                req.user!.org_id,
                data.pest_id,
                data.treatment_name,
                data.treatment_method || null,
                data.products || null,
                data.application_instructions || null,
                data.effectiveness_rating || null,
                data.is_global || false
            ]
        );

        res.status(201).json({ treatment: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

// Pest Occurrences
pestsRouter.get('/occurrences', async (req: AuthRequest, res, next) => {
    try {
        const hiveId = req.query.hive_id as string | undefined;
        const pestId = req.query.pest_id as string | undefined;

        let query = `
            SELECT po.*, p.name as pest_name, h.label as hive_label
            FROM pest_occurrences po
            JOIN pest_knowledge_base p ON po.pest_id = p.id
            JOIN hives h ON po.hive_id = h.id
            WHERE po.org_id = $1
        `;
        const params: any[] = [req.user!.org_id];

        if (hiveId) {
            query += ' AND po.hive_id = $2';
            params.push(hiveId);
        }

        if (pestId) {
            query += ` AND po.pest_id = $${params.length + 1}`;
            params.push(pestId);
        }

        query += ' ORDER BY po.occurrence_date DESC';

        const result = await pool.query(query, params);
        res.json({ occurrences: result.rows });
    } catch (error) {
        next(error);
    }
});

pestsRouter.post('/occurrences', async (req: AuthRequest, res, next) => {
    try {
        const data = CreatePestOccurrenceSchema.parse(req.body);

        const result = await pool.query(
            `INSERT INTO pest_occurrences (org_id, hive_id, pest_id, inspection_id, occurrence_date, severity, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [
                req.user!.org_id,
                data.hive_id,
                data.pest_id,
                data.inspection_id || null,
                data.occurrence_date,
                data.severity || null,
                data.notes || null
            ]
        );

        const occurrence = result.rows[0];

        await logActivity(
            req.user!.org_id,
            req.user!.id,
            'report_pest_occurrence',
            'pest_occurrence',
            occurrence.id,
            { pest_id: occurrence.pest_id, hive_id: occurrence.hive_id }
        );

        res.status(201).json({ occurrence });
    } catch (error) {
        next(error);
    }
});

// Record treatment application
pestsRouter.post('/occurrences/:id/treat', async (req: AuthRequest, res, next) => {
    try {
        const data = CreateTreatmentEffectivenessSchema.parse({ ...req.body, pest_occurrence_id: req.params.id });

        // Verify occurrence exists
        const occurrenceResult = await pool.query(
            `SELECT * FROM pest_occurrences
             WHERE id = $1 AND org_id = $2`,
            [req.params.id, req.user!.org_id]
        );

        if (occurrenceResult.rows.length === 0) {
            return res.status(404).json({ error: 'Pest occurrence not found' });
        }

        const result = await pool.query(
            `INSERT INTO treatment_effectiveness (org_id, pest_occurrence_id, treatment_id, treatment_date, effectiveness_rating, notes)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [
                req.user!.org_id,
                data.pest_occurrence_id,
                data.treatment_id,
                data.treatment_date,
                data.effectiveness_rating || null,
                data.notes || null
            ]
        );

        await logActivity(
            req.user!.org_id,
            req.user!.id,
            'apply_pest_treatment',
            'treatment_effectiveness',
            result.rows[0].id,
            { pest_occurrence_id: data.pest_occurrence_id, treatment_id: data.treatment_id }
        );

        res.status(201).json({ treatment_effectiveness: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

// Get treatment history for an occurrence
pestsRouter.get('/occurrences/:id/treatments', async (req: AuthRequest, res, next) => {
    try {
        const result = await pool.query(
            `SELECT te.*, pt.treatment_name, pt.treatment_method
             FROM treatment_effectiveness te
             JOIN pest_treatments pt ON te.treatment_id = pt.id
             WHERE te.pest_occurrence_id = $1 AND te.org_id = $2
             ORDER BY te.treatment_date DESC`,
            [req.params.id, req.user!.org_id]
        );

        res.json({ treatments: result.rows });
    } catch (error) {
        next(error);
    }
});
