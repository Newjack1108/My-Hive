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

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
