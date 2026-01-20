import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { apiariesRouter } from './routes/apiaries.js';
import { hivesRouter } from './routes/hives.js';
import { inspectionsRouter } from './routes/inspections.js';
import { photosRouter } from './routes/photos.js';
import { tasksRouter } from './routes/tasks.js';
import { activityRouter } from './routes/activity.js';
import { syncRouter } from './routes/sync.js';
import { errorHandler } from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// Log startup info (remove sensitive data)
console.log('Starting server...');
console.log('PORT:', PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'NOT SET');
console.log('CORS_ORIGIN:', process.env.CORS_ORIGIN || 'default');

// CORS - allow requests from web app domain or default to wildcard in production
const corsOrigin = process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'production' ? '*' : 'http://localhost:5173');
app.use(cors({
    origin: corsOrigin,
    credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/apiaries', apiariesRouter);
app.use('/api/hives', hivesRouter);
app.use('/api/inspections', inspectionsRouter);
app.use('/api/photos', photosRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/activity', activityRouter);
app.use('/api/sync', syncRouter);

app.use(errorHandler);

// Serve static files from web app dist folder (must be after API routes)
const webDistPath = join(__dirname, '../../web/dist');
app.use(express.static(webDistPath));

// Serve web app for all non-API routes (SPA fallback)
app.get('*', (req, res) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'Not found' });
    }
    res.sendFile(join(webDistPath, 'index.html'), (err) => {
        if (err) {
            res.status(500).send('Error loading application');
        }
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Server is ready to accept connections');
});

// Handle unhandled errors
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});
