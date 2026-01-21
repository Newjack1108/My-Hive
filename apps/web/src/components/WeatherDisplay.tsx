import { useState } from 'react';
import { WeatherData } from '@my-hive/shared';
import './WeatherDisplay.css';

interface WeatherDisplayProps {
  weather: WeatherData | null;
  compact?: boolean;
  showDetails?: boolean;
}

export default function WeatherDisplay({ weather, compact = false, showDetails = false }: WeatherDisplayProps) {
  const [expanded, setExpanded] = useState(showDetails);

  if (!weather || !weather.current) {
    return (
      <div className="weather-display weather-unavailable">
        <img src="/weather-icon.png" alt="Weather" className="weather-icon" />
        <span>Weather unavailable</span>
      </div>
    );
  }

  const current = weather.current;
  const historical = weather.historical;

  // Use historical weather if available (for past inspections)
  const displayData = historical || current;

  // Get weather icon URL from OpenWeatherMap
  const iconUrl = `https://openweathermap.org/img/wn/${displayData.icon}@2x.png`;

  if (compact) {
    return (
      <div className="weather-display weather-compact">
        <img src={iconUrl} alt={displayData.conditions} className="weather-icon-small" />
        <span className="weather-temp">{displayData.temp}°F</span>
        <span className="weather-conditions">{displayData.conditions}</span>
      </div>
    );
  }

  return (
    <div className="weather-display">
      <div 
        className="weather-header" 
        onClick={() => setExpanded(!expanded)}
        style={{ cursor: 'pointer' }}
      >
        <div className="weather-main">
          <img src={iconUrl} alt={displayData.conditions} className="weather-icon" />
          <div className="weather-info">
            <div className="weather-temp-large">{displayData.temp}°F</div>
            <div className="weather-description">{displayData.description}</div>
          </div>
        </div>
        <button 
          className="weather-expand-btn"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
        >
          {expanded ? '▼' : '▶'}
        </button>
      </div>

      {expanded && (
        <div className="weather-details">
          {historical && (
            <div className="weather-badge weather-historical">
              Historical weather for {new Date(historical.date).toLocaleDateString()}
            </div>
          )}
          
          <div className="weather-grid">
            <div className="weather-detail-item">
              <span className="weather-detail-label">Feels Like</span>
              <span className="weather-detail-value">{current.feels_like}°F</span>
            </div>
            <div className="weather-detail-item">
              <span className="weather-detail-label">Humidity</span>
              <span className="weather-detail-value">{current.humidity}%</span>
            </div>
            <div className="weather-detail-item">
              <span className="weather-detail-label">Wind Speed</span>
              <span className="weather-detail-value">{current.wind_speed} mph</span>
            </div>
            {current.wind_direction !== undefined && (
              <div className="weather-detail-item">
                <span className="weather-detail-label">Wind Direction</span>
                <span className="weather-detail-value">
                  {current.wind_direction}° ({getWindDirection(current.wind_direction)})
                </span>
              </div>
            )}
            <div className="weather-detail-item">
              <span className="weather-detail-label">Pressure</span>
              <span className="weather-detail-value">{current.pressure} hPa</span>
            </div>
            {current.visibility !== undefined && (
              <div className="weather-detail-item">
                <span className="weather-detail-label">Visibility</span>
                <span className="weather-detail-value">{current.visibility} km</span>
              </div>
            )}
          </div>

          {weather.forecast && weather.forecast.length > 0 && (
            <div className="weather-forecast">
              <h4>7-Day Forecast</h4>
              <div className="forecast-list">
                {weather.forecast.map((day, index) => (
                  <div key={index} className="forecast-item">
                    <span className="forecast-date">
                      {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                    <img 
                      src={`https://openweathermap.org/img/wn/${day.icon}@2x.png`} 
                      alt={day.conditions}
                      className="forecast-icon"
                    />
                    <span className="forecast-temp">{day.temp_min}° / {day.temp_max}°</span>
                    <span className="forecast-desc">{day.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getWindDirection(degrees: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return directions[Math.round(degrees / 22.5) % 16];
}
