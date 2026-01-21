import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { pool } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { logActivity } from '../utils/activity.js';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdir, writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';

export const photosRouter = express.Router();

photosRouter.use(authenticateToken);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Storage directory for photos
const STORAGE_DIR = join(__dirname, '../../storage/photos');
const THUMBNAIL_DIR = join(__dirname, '../../storage/thumbnails');

// Ensure storage directories exist
async function ensureStorageDirs() {
    if (!existsSync(STORAGE_DIR)) {
        await mkdir(STORAGE_DIR, { recursive: true });
    }
    if (!existsSync(THUMBNAIL_DIR)) {
        await mkdir(THUMBNAIL_DIR, { recursive: true });
    }
}

// Initialize storage directories on module load
ensureStorageDirs().catch(console.error);

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

// Image processing constants
const MAX_DIMENSION = 1600;
const THUMBNAIL_SIZE = 300;

// Helper function to process image
async function processImage(fileBuffer: Buffer): Promise<{
    processedBuffer: Buffer;
    thumbnailBuffer: Buffer;
    metadata: sharp.Metadata;
}> {
    let image = sharp(fileBuffer);
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
    const thumbnailBuffer = await sharp(fileBuffer)
        .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
            fit: 'cover',
        })
        .jpeg({ quality: 80 })
        .toBuffer();

    // Get final dimensions
    const finalMetadata = await sharp(processedBuffer).metadata();

    return {
        processedBuffer,
        thumbnailBuffer,
        metadata: finalMetadata,
    };
}

// Helper function to save image to filesystem
async function saveImage(buffer: Buffer, filename: string, isThumbnail: boolean = false): Promise<string> {
    await ensureStorageDirs();
    const dir = isThumbnail ? THUMBNAIL_DIR : STORAGE_DIR;
    const filepath = join(dir, filename);
    await writeFile(filepath, buffer);
    return filepath;
}

// Helper function to verify entity ownership
async function verifyEntityOwnership(
    entityType: 'apiary' | 'hive' | 'queen' | 'inspection',
    entityId: string,
    orgId: string
): Promise<boolean> {
    let query = '';
    switch (entityType) {
        case 'apiary':
            query = 'SELECT id FROM apiaries WHERE id = $1 AND org_id = $2';
            break;
        case 'hive':
            query = 'SELECT id FROM hives WHERE id = $1 AND org_id = $2';
            break;
        case 'queen':
            query = 'SELECT id FROM queen_records WHERE id = $1 AND org_id = $2';
            break;
        case 'inspection':
            query = 'SELECT id FROM inspections WHERE id = $1 AND org_id = $2';
            break;
    }

    const result = await pool.query(query, [entityId, orgId]);
    return result.rows.length > 0;
}

// Helper function to upload photo for any entity type
async function uploadPhoto(
    req: AuthRequest,
    res: express.Response,
    next: express.NextFunction,
    entityType: 'apiary' | 'hive' | 'queen' | 'inspection',
    entityId: string
) {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        // Verify entity belongs to org
        const exists = await verifyEntityOwnership(entityType, entityId, req.user!.org_id);
        if (!exists) {
            return res.status(404).json({ error: `${entityType} not found` });
        }

        // Process image
        const { processedBuffer, thumbnailBuffer, metadata } = await processImage(req.file.buffer);

        // Generate filenames
        const photoId = uuidv4();
        const photoFilename = `${photoId}.jpg`;
        const thumbnailFilename = `${photoId}.jpg`;

        // Save images to filesystem
        await saveImage(processedBuffer, photoFilename, false);
        await saveImage(thumbnailBuffer, thumbnailFilename, true);

        // Determine table and column names
        let tableName: string;
        let entityColumn: string;
        let entityTypeName: string;

        switch (entityType) {
            case 'apiary':
                tableName = 'apiary_photos';
                entityColumn = 'apiary_id';
                entityTypeName = 'apiary_photo';
                break;
            case 'hive':
                tableName = 'hive_photos';
                entityColumn = 'hive_id';
                entityTypeName = 'hive_photo';
                break;
            case 'queen':
                tableName = 'queen_photos';
                entityColumn = 'queen_id';
                entityTypeName = 'queen_photo';
                break;
            case 'inspection':
                tableName = 'inspection_photos';
                entityColumn = 'inspection_id';
                entityTypeName = 'inspection_photo';
                break;
        }

        // Store metadata in database
        const storageKey = `photos/${photoFilename}`;
        const thumbnailKey = `thumbnails/${thumbnailFilename}`;

        const result = await pool.query(
            `INSERT INTO ${tableName} (
                org_id, ${entityColumn}, storage_key, storage_type,
                thumbnail_storage_key, width, height, bytes, mime_type
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *`,
            [
                req.user!.org_id,
                entityId,
                storageKey,
                'local',
                thumbnailKey,
                metadata.width,
                metadata.height,
                processedBuffer.length,
                'image/jpeg',
            ]
        );

        await logActivity(
            req.user!.org_id,
            req.user!.id,
            'upload_photo',
            entityTypeName,
            result.rows[0].id,
            { [`${entityType}_id`]: entityId, bytes: processedBuffer.length }
        );

        res.status(201).json({
            photo: {
                ...result.rows[0],
                url: `/api/photos/${result.rows[0].id}/image`,
                thumbnail_url: `/api/photos/${result.rows[0].id}/thumbnail`,
            },
        });
    } catch (error) {
        next(error);
    }
}

// Upload photo for apiary
photosRouter.post('/apiaries/:apiaryId', upload.single('photo'), async (req: AuthRequest, res, next) => {
    await uploadPhoto(req, res, next, 'apiary', req.params.apiaryId);
});

// Upload photo for hive
photosRouter.post('/hives/:hiveId', upload.single('photo'), async (req: AuthRequest, res, next) => {
    await uploadPhoto(req, res, next, 'hive', req.params.hiveId);
});

// Upload photo for queen
photosRouter.post('/queens/:queenId', upload.single('photo'), async (req: AuthRequest, res, next) => {
    await uploadPhoto(req, res, next, 'queen', req.params.queenId);
});

// Upload photo for inspection (backward compatibility)
photosRouter.post('/:inspectionId', upload.single('photo'), async (req: AuthRequest, res, next) => {
    await uploadPhoto(req, res, next, 'inspection', req.params.inspectionId);
});

// Helper function to find photo in any table
async function findPhoto(photoId: string, orgId: string): Promise<{
    photo: any;
    tableName: string;
} | null> {
    const tables = [
        { name: 'inspection_photos', type: 'inspection' },
        { name: 'apiary_photos', type: 'apiary' },
        { name: 'hive_photos', type: 'hive' },
        { name: 'queen_photos', type: 'queen' },
    ];

    for (const table of tables) {
        const result = await pool.query(
            `SELECT * FROM ${table.name} WHERE id = $1 AND org_id = $2`,
            [photoId, orgId]
        );
        if (result.rows.length > 0) {
            return { photo: result.rows[0], tableName: table.name };
        }
    }

    return null;
}

// Get photo image (full size)
photosRouter.get('/:id/image', async (req: AuthRequest, res, next) => {
    try {
        const photoData = await findPhoto(req.params.id, req.user!.org_id);

        if (!photoData) {
            return res.status(404).json({ error: 'Photo not found' });
        }

        const { photo } = photoData;
        const filename = photo.storage_key.split('/').pop() || `${photo.id}.jpg`;
        const filepath = join(STORAGE_DIR, filename);

        try {
            const imageBuffer = await readFile(filepath);
            res.setHeader('Content-Type', photo.mime_type || 'image/jpeg');
            res.setHeader('Content-Length', imageBuffer.length);
            res.send(imageBuffer);
        } catch (error) {
            console.error('Error reading image file:', error);
            return res.status(404).json({ error: 'Image file not found' });
        }
    } catch (error) {
        next(error);
    }
});

// Get photo thumbnail
photosRouter.get('/:id/thumbnail', async (req: AuthRequest, res, next) => {
    try {
        const photoData = await findPhoto(req.params.id, req.user!.org_id);

        if (!photoData) {
            return res.status(404).json({ error: 'Photo not found' });
        }

        const { photo } = photoData;
        const filename = photo.thumbnail_storage_key?.split('/').pop() || `${photo.id}.jpg`;
        const filepath = join(THUMBNAIL_DIR, filename);

        try {
            const imageBuffer = await readFile(filepath);
            res.setHeader('Content-Type', photo.mime_type || 'image/jpeg');
            res.setHeader('Content-Length', imageBuffer.length);
            res.send(imageBuffer);
        } catch (error) {
            console.error('Error reading thumbnail file:', error);
            return res.status(404).json({ error: 'Thumbnail file not found' });
        }
    } catch (error) {
        next(error);
    }
});
