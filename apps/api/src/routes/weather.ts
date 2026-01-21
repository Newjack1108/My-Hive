import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { getCurrentWeather, getWeatherForecast, getHistoricalWeather, getWeatherData } from '../utils/weatherService.js';
import { WeatherDataSchema } from '@my-hive/shared';

export const weatherRouter = express.Router();

weatherRouter.use(authenticateToken);

// Get current weather for a location
weatherRouter.get('/current', async (req: AuthRequest, res, next) => {
    try {
        const lat = parseFloat(req.query.lat as string);
        const lng = parseFloat(req.query.lng as string);

        if (isNaN(lat) || isNaN(lng)) {
            return res.status(400).json({ error: 'Valid lat and lng parameters are required' });
        }

        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return res.status(400).json({ error: 'Invalid latitude or longitude values' });
        }

        const weather = await getCurrentWeather(lat, lng);
        
        if (!weather) {
            return res.status(503).json({ error: 'Weather service unavailable' });
        }

        res.json({ weather });
    } catch (error) {
        next(error);
    }
});

// Get weather forecast for a location
weatherRouter.get('/forecast', async (req: AuthRequest, res, next) => {
    try {
        const lat = parseFloat(req.query.lat as string);
        const lng = parseFloat(req.query.lng as string);

        if (isNaN(lat) || isNaN(lng)) {
            return res.status(400).json({ error: 'Valid lat and lng parameters are required' });
        }

        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return res.status(400).json({ error: 'Invalid latitude or longitude values' });
        }

        const forecast = await getWeatherForecast(lat, lng);
        
        if (!forecast) {
            return res.status(503).json({ error: 'Weather forecast service unavailable' });
        }

        res.json({ forecast });
    } catch (error) {
        next(error);
    }
});

// Get historical weather for a location and date
weatherRouter.get('/historical', async (req: AuthRequest, res, next) => {
    try {
        const lat = parseFloat(req.query.lat as string);
        const lng = parseFloat(req.query.lng as string);
        const date = req.query.date as string;

        if (isNaN(lat) || isNaN(lng)) {
            return res.status(400).json({ error: 'Valid lat and lng parameters are required' });
        }

        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return res.status(400).json({ error: 'Invalid latitude or longitude values' });
        }

        if (!date) {
            return res.status(400).json({ error: 'Date parameter is required (YYYY-MM-DD format)' });
        }

        // Validate date format
        const dateRegex = /^\d{4}-\d{2}-\d{2}/;
        if (!dateRegex.test(date)) {
            return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
        }

        const historical = await getHistoricalWeather(lat, lng, date);
        
        if (!historical) {
            return res.status(404).json({ error: 'Historical weather data not available for this date' });
        }

        res.json({ weather: historical });
    } catch (error) {
        next(error);
    }
});

// Get complete weather data (current + optional forecast + optional historical)
weatherRouter.get('/complete', async (req: AuthRequest, res, next) => {
    try {
        const lat = parseFloat(req.query.lat as string);
        const lng = parseFloat(req.query.lng as string);
        const includeForecast = req.query.forecast === 'true';
        const historicalDate = req.query.historical_date as string | undefined;

        if (isNaN(lat) || isNaN(lng)) {
            return res.status(400).json({ error: 'Valid lat and lng parameters are required' });
        }

        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return res.status(400).json({ error: 'Invalid latitude or longitude values' });
        }

        const weatherData = await getWeatherData(lat, lng, {
            includeForecast,
            historicalDate,
        });

        if (!weatherData) {
            return res.status(503).json({ error: 'Weather service unavailable' });
        }

        // Validate with schema
        const validated = WeatherDataSchema.parse(weatherData);
        res.json({ weather: validated });
    } catch (error) {
        next(error);
    }
});
