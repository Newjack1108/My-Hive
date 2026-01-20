import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Log startup info (remove sensitive data)
console.log('Starting server...');
console.log('PORT:', PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'NOT SET');
console.log('CORS_ORIGIN:', process.env.CORS_ORIGIN || 'default');

app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
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
