import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { pool } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { logActivity } from '../utils/activity.js';
import { v4 as uuidv4 } from 'uuid';

export const photosRouter = express.Router();

photosRouter.use(authenticateToken);

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    },
});

// Upload photo for inspection
photosRouter.post('/:inspectionId', upload.single('photo'), async (req: AuthRequest, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        const { inspectionId } = req.params;

        // Verify inspection belongs to org
        const inspectionCheck = await pool.query(
            'SELECT id, org_id FROM inspections WHERE id = $1 AND org_id = $2',
            [inspectionId, req.user!.org_id]
        );

        if (inspectionCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Inspection not found' });
        }

        // Process image: resize to max 1600px on longest edge, compress to JPEG
        const MAX_DIMENSION = 1600;
        const THUMBNAIL_SIZE = 300;

        let image = sharp(req.file.buffer);
        const metadata = await image.metadata();
        const { width, height } = metadata;

        // Resize main image if needed
        if (width && height && (width > MAX_DIMENSION || height > MAX_DIMENSION)) {
            image = image.resize(MAX_DIMENSION, MAX_DIMENSION, {
                fit: 'inside',
                withoutEnlargement: true,
            });
        }

        // Convert to JPEG and compress
        const processedBuffer = await image
            .jpeg({ quality: 85, progressive: true })
            .toBuffer();

        // Create thumbnail
        const thumbnailBuffer = await sharp(req.file.buffer)
            .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
                fit: 'cover',
            })
            .jpeg({ quality: 80 })
            .toBuffer();

        // Get final dimensions
        const finalMetadata = await sharp(processedBuffer).metadata();

        // Store in database as bytea (MVP - can be abstracted to object storage later)
        const storageKey = `photos/${uuidv4()}.jpg`;
        const thumbnailKey = `thumbnails/${uuidv4()}.jpg`;

        const result = await pool.query(
            `INSERT INTO inspection_photos (
                org_id, inspection_id, storage_key, storage_type,
                thumbnail_storage_key, width, height, bytes, mime_type
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *`,
            [
                req.user!.org_id,
                inspectionId,
                storageKey,
                'bytea',
                thumbnailKey,
                finalMetadata.width,
                finalMetadata.height,
                processedBuffer.length,
                'image/jpeg',
            ]
        );

        // Store actual image data (for MVP - in production, use object storage)
        // For now, we'll store a reference and the frontend will fetch via API
        // In a full implementation, you'd upload to S3/CloudFlare/etc here

        await logActivity(
            req.user!.org_id,
            req.user!.id,
            'upload_photo',
            'inspection_photo',
            result.rows[0].id,
            { inspection_id: inspectionId, bytes: processedBuffer.length }
        );

        res.status(201).json({
            photo: {
                ...result.rows[0],
                // In production, return signed URL instead
                url: `/api/photos/${result.rows[0].id}/image`,
                thumbnail_url: `/api/photos/${result.rows[0].id}/thumbnail`,
            },
        });
    } catch (error) {
        next(error);
    }
});

// Get photo image (placeholder - in production, serve from object storage)
photosRouter.get('/:id/image', async (req: AuthRequest, res, next) => {
    try {
        const result = await pool.query(
            'SELECT * FROM inspection_photos WHERE id = $1 AND org_id = $2',
            [req.params.id, req.user!.org_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Photo not found' });
        }

        // In MVP, return placeholder. In production, fetch from object storage
        res.json({ message: 'Photo endpoint - implement object storage retrieval' });
    } catch (error) {
        next(error);
    }
});
