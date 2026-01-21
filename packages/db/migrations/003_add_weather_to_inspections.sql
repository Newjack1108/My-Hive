-- Add weather_json column to inspections table for storing weather data
ALTER TABLE inspections ADD COLUMN weather_json JSONB;

-- Add index for weather data queries (if needed for filtering by weather conditions)
-- CREATE INDEX idx_inspections_weather_json ON inspections USING GIN (weather_json);

COMMENT ON COLUMN inspections.weather_json IS 'Stores weather data (current, forecast, historical) captured during inspection';
