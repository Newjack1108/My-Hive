import axios from 'axios';
import { WeatherData, WeatherCurrent, WeatherForecastItem, WeatherHistorical } from '@my-hive/shared';

const OPENWEATHERMAP_API_KEY = process.env.OPENWEATHERMAP_API_KEY;
const BASE_URL = 'https://api.openweathermap.org/data/2.5';

// Simple in-memory cache
interface CacheEntry {
    data: any;
    timestamp: number;
    ttl: number; // Time to live in milliseconds
}

const cache = new Map<string, CacheEntry>();

function getCacheKey(type: string, lat: number, lng: number, date?: string): string {
    return `${type}:${lat}:${lng}${date ? `:${date}` : ''}`;
}

function getFromCache(key: string): any | null {
    const entry = cache.get(key);
    if (!entry) return null;
    
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
        cache.delete(key);
        return null;
    }
    
    return entry.data;
}

function setCache(key: string, data: any, ttl: number): void {
    cache.set(key, {
        data,
        timestamp: Date.now(),
        ttl,
    });
}

function celsiusToFahrenheit(celsius: number): number {
    return Math.round((celsius * 9/5) + 32);
}

function degToCompass(deg: number): string {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return directions[Math.round(deg / 22.5) % 16];
}

export async function getCurrentWeather(lat: number, lng: number): Promise<WeatherCurrent | null> {
    if (!OPENWEATHERMAP_API_KEY) {
        console.warn('OPENWEATHERMAP_API_KEY not configured');
        return null;
    }

    const cacheKey = getCacheKey('current', lat, lng);
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    try {
        const response = await axios.get(`${BASE_URL}/weather`, {
            params: {
                lat,
                lon: lng,
                appid: OPENWEATHERMAP_API_KEY,
                units: 'metric', // Get in metric, we'll convert if needed
            },
        });

        const data = response.data;
        const weather: WeatherCurrent = {
            temp: celsiusToFahrenheit(data.main.temp), // Convert Celsius to Fahrenheit for US users
            feels_like: celsiusToFahrenheit(data.main.feels_like),
            humidity: data.main.humidity,
            pressure: data.main.pressure,
            wind_speed: data.wind?.speed ? Math.round(data.wind.speed * 2.237) : 0, // Convert m/s to mph
            wind_direction: data.wind?.deg,
            visibility: data.visibility ? Math.round(data.visibility / 1000) : undefined, // Convert to km
            conditions: data.weather[0]?.main || 'Unknown',
            icon: data.weather[0]?.icon || '01d',
            description: data.weather[0]?.description || 'Unknown',
        };

        // Cache for 1 hour
        setCache(cacheKey, weather, 60 * 60 * 1000);
        return weather;
    } catch (error: any) {
        console.error('Error fetching current weather:', error.response?.data || error.message);
        return null;
    }
}

export async function getWeatherForecast(lat: number, lng: number): Promise<WeatherForecastItem[] | null> {
    if (!OPENWEATHERMAP_API_KEY) {
        console.warn('OPENWEATHERMAP_API_KEY not configured');
        return null;
    }

    const cacheKey = getCacheKey('forecast', lat, lng);
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    try {
        const response = await axios.get(`${BASE_URL}/forecast`, {
            params: {
                lat,
                lon: lng,
                appid: OPENWEATHERMAP_API_KEY,
                units: 'metric',
                cnt: 40, // 5 days, 8 forecasts per day
            },
        });

        // Group forecasts by day and get min/max temps
        const dailyData = new Map<string, {
            temp_min: number;
            temp_max: number;
            conditions: string;
            icon: string;
            description: string;
            humidity: number;
            wind_speed: number;
        }>();

        response.data.list.forEach((item: any) => {
            const date = new Date(item.dt * 1000).toISOString().split('T')[0];
            const existing = dailyData.get(date);
            
            const temp = celsiusToFahrenheit(item.main.temp);
            const tempMin = celsiusToFahrenheit(item.main.temp_min);
            const tempMax = celsiusToFahrenheit(item.main.temp_max);
            const windSpeed = item.wind?.speed ? Math.round(item.wind.speed * 2.237) : 0;

            if (!existing) {
                dailyData.set(date, {
                    temp_min: tempMin,
                    temp_max: tempMax,
                    conditions: item.weather[0]?.main || 'Unknown',
                    icon: item.weather[0]?.icon || '01d',
                    description: item.weather[0]?.description || 'Unknown',
                    humidity: item.main.humidity,
                    wind_speed: windSpeed,
                });
            } else {
                existing.temp_min = Math.min(existing.temp_min, tempMin);
                existing.temp_max = Math.max(existing.temp_max, tempMax);
            }
        });

        const forecast: WeatherForecastItem[] = Array.from(dailyData.entries())
            .slice(0, 7) // 7-day forecast
            .map(([date, data]) => ({
                date,
                temp_min: data.temp_min,
                temp_max: data.temp_max,
                conditions: data.conditions,
                icon: data.icon,
                description: data.description,
                humidity: data.humidity,
                wind_speed: data.wind_speed,
            }));

        // Cache for 6 hours
        setCache(cacheKey, forecast, 6 * 60 * 60 * 1000);
        return forecast;
    } catch (error: any) {
        console.error('Error fetching weather forecast:', error.response?.data || error.message);
        return null;
    }
}

export async function getHistoricalWeather(lat: number, lng: number, date: string): Promise<WeatherHistorical | null> {
    if (!OPENWEATHERMAP_API_KEY) {
        console.warn('OPENWEATHERMAP_API_KEY not configured');
        return null;
    }

    const cacheKey = getCacheKey('historical', lat, lng, date);
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    try {
        // OpenWeatherMap One Call API 3.0 requires subscription for historical data
        // For free tier, we'll use the current weather and note the limitation
        // Or use Open-Meteo which provides free historical data
        
        // Using Open-Meteo Historical Weather API (free alternative)
        const targetDate = new Date(date);
        const today = new Date();
        const daysAgo = Math.floor((today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysAgo > 90) {
            // Historical data only available for last 90 days via free APIs
            console.warn(`Historical weather available only for last 90 days. Requested date: ${date}`);
            return null;
        }

        // Using Open-Meteo for historical data (free, no API key needed)
        const historicalDate = date.split('T')[0]; // Ensure we only use date part
        const meteoTargetDate = new Date(historicalDate);
        const todayStr = new Date().toISOString().split('T')[0];
        
        if (historicalDate >= todayStr) {
            // If date is today or future, get current weather instead
            const current = await getCurrentWeather(lat, lng);
            if (!current) return null;
            
            return {
                date: historicalDate,
                temp: current.temp,
                temp_min: current.temp - 5, // Estimate
                temp_max: current.temp + 5, // Estimate
                humidity: current.humidity,
                pressure: current.pressure,
                wind_speed: current.wind_speed,
                conditions: current.conditions,
                icon: current.icon,
                description: current.description,
            };
        }

        // Use Open-Meteo Historical Weather API
        const response = await axios.get('https://archive-api.open-meteo.com/v1/archive', {
            params: {
                latitude: lat,
                longitude: lng,
                start_date: historicalDate,
                end_date: historicalDate,
                hourly: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m',
                timezone: 'auto',
            },
        });

        const hourly = response.data.hourly;
        if (!hourly || !hourly.time || hourly.time.length === 0) {
            return null;
        }

        // Get average/representative values for the day
        const temps = hourly.temperature_2m.filter((t: any) => t !== null);
        const humidities = hourly.relative_humidity_2m.filter((h: any) => h !== null);
        const windSpeeds = hourly.wind_speed_10m.filter((w: any) => w !== null);
        
        const avgTemp = temps.length > 0 
            ? Math.round((temps.reduce((a: number, b: number) => a + b, 0) / temps.length) * 9/5 + 32)
            : null;
        const avgHumidity = humidities.length > 0
            ? Math.round(humidities.reduce((a: number, b: number) => a + b, 0) / humidities.length)
            : null;
        const avgWindSpeed = windSpeeds.length > 0
            ? Math.round(windSpeeds.reduce((a: number, b: number) => a + b, 0) / windSpeeds.length * 0.621371) // Convert km/h to mph
            : null;

        // Map weather code to condition (simplified)
        const weatherCode = hourly.weather_code[Math.floor(hourly.weather_code.length / 2)];
        const conditionMap: Record<number, string> = {
            0: 'Clear',
            1: 'Mainly Clear',
            2: 'Partly Cloudy',
            3: 'Overcast',
            45: 'Foggy',
            48: 'Foggy',
            51: 'Drizzle',
            61: 'Rain',
            71: 'Snow',
            80: 'Rain Showers',
        };
        
        const conditions = conditionMap[weatherCode] || 'Unknown';
        const iconMap: Record<string, string> = {
            'Clear': '01d',
            'Mainly Clear': '02d',
            'Partly Cloudy': '02d',
            'Overcast': '04d',
            'Foggy': '50d',
            'Drizzle': '09d',
            'Rain': '10d',
            'Snow': '13d',
            'Rain Showers': '09d',
        };

        const historical: WeatherHistorical = {
            date: historicalDate,
            temp: avgTemp || 0,
            temp_min: avgTemp ? avgTemp - 5 : undefined,
            temp_max: avgTemp ? avgTemp + 5 : undefined,
            humidity: avgHumidity || undefined,
            wind_speed: avgWindSpeed || undefined,
            conditions,
            icon: iconMap[conditions] || '01d',
            description: conditions,
        };

        // Cache historical data indefinitely (it doesn't change)
        setCache(cacheKey, historical, 365 * 24 * 60 * 60 * 1000);
        return historical;
    } catch (error: any) {
        console.error('Error fetching historical weather:', error.response?.data || error.message);
        return null;
    }
}

export async function getWeatherData(
    lat: number,
    lng: number,
    options: {
        includeForecast?: boolean;
        historicalDate?: string;
    } = {}
): Promise<WeatherData | null> {
    const current = await getCurrentWeather(lat, lng);
    if (!current) return null;

    const weatherData: WeatherData = {
        current,
        timestamp: new Date().toISOString(),
        location: { lat, lng },
    };

    if (options.includeForecast) {
        weatherData.forecast = await getWeatherForecast(lat, lng) || undefined;
    }

    if (options.historicalDate) {
        weatherData.historical = await getHistoricalWeather(lat, lng, options.historicalDate) || undefined;
    }

    return weatherData;
}
