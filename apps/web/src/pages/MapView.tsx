import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../utils/api';
import './MapView.css';

// Fix for default marker icons in React-Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface Apiary {
  id: string;
  name: string;
  lat: number;
  lng: number;
  feeding_radius_m?: number;
}

interface Overlap {
  apiary1: Apiary;
  apiary2: Apiary;
  distance_meters: number;
  overlap_area_sq_meters: number;
}

export default function MapView() {
  const [apiaries, setApiaries] = useState<Apiary[]>([]);
  const [overlaps, setOverlaps] = useState<Overlap[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOverlaps, setShowOverlaps] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>([51.505, -0.09]);
  const [mapZoom, setMapZoom] = useState(6);

  useEffect(() => {
    loadData();
  }, []);

  // Set map center based on apiaries
  useEffect(() => {
    if (apiaries.length > 0) {
      const validApiaries = apiaries.filter(a => a.lat && a.lng);
      if (validApiaries.length > 0) {
        const avgLat = validApiaries.reduce((sum, a) => sum + a.lat, 0) / validApiaries.length;
        const avgLng = validApiaries.reduce((sum, a) => sum + a.lng, 0) / validApiaries.length;
        setMapCenter([avgLat, avgLng]);
        setMapZoom(validApiaries.length === 1 ? 12 : 8);
      }
    }
  }, [apiaries]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [apiariesRes, overlapsRes] = await Promise.all([
        api.get('/apiaries/map'),
        showOverlaps ? api.get('/apiaries/overlaps') : Promise.resolve({ data: { overlaps: [] } })
      ]);

      setApiaries(apiariesRes.data.apiaries);
      if (showOverlaps) {
        setOverlaps(overlapsRes.data.overlaps);
      }
    } catch (error) {
      console.error('Failed to load map data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (showOverlaps) {
      loadData();
    }
  }, [showOverlaps]);

  if (loading) {
    return <div className="map-loading">Loading map...</div>;
  }

  return (
    <div className="map-view">
      <div className="map-header">
        <h2>Apiary Map</h2>
        <label className="overlap-toggle">
          <input
            type="checkbox"
            checked={showOverlaps}
            onChange={(e) => setShowOverlaps(e.target.checked)}
          />
          Show Feeding Radius Overlaps
        </label>
      </div>

      <div className="map-container">
        {apiaries.length > 0 && apiaries.some(a => a.lat && a.lng) ? (
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {apiaries
              .filter(apiary => apiary.lat && apiary.lng)
              .map((apiary) => (
                <Marker key={`marker-${apiary.id}`} position={[apiary.lat, apiary.lng]}>
                  <Popup>
                    <strong>{apiary.name}</strong>
                    {apiary.feeding_radius_m && (
                      <div>Feeding Radius: {apiary.feeding_radius_m}m</div>
                    )}
                  </Popup>
                </Marker>
              ))}
            {apiaries
              .filter(apiary => apiary.lat && apiary.lng && apiary.feeding_radius_m)
              .map((apiary) => (
                <Circle
                  key={`circle-${apiary.id}`}
                  center={[apiary.lat, apiary.lng]}
                  radius={apiary.feeding_radius_m}
                  pathOptions={{
                    color: showOverlaps ? '#ff0000' : '#3388ff',
                    fillColor: showOverlaps ? '#ff0000' : '#3388ff',
                    fillOpacity: 0.2,
                    weight: 2
                  }}
                />
              ))}
          </MapContainer>
        ) : (
          <div className="map-placeholder">
            <p>No apiaries with coordinates found</p>
            <p>Add coordinates to your apiaries to see them on the map</p>
          </div>
        )}
      </div>

      <div className="map-info">
        <div className="apiaries-list">
          <h3>Apiaries ({apiaries.length})</h3>
          {apiaries.length === 0 ? (
            <p>No apiaries with coordinates found</p>
          ) : (
            <ul>
              {apiaries.map((apiary) => (
                <li key={apiary.id}>
                  <strong>{apiary.name}</strong>
                  {apiary.feeding_radius_m && (
                    <span> - Radius: {apiary.feeding_radius_m}m</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {showOverlaps && overlaps.length > 0 && (
          <div className="overlaps-list">
            <h3>Overlaps ({overlaps.length})</h3>
            <ul>
              {overlaps.map((overlap, idx) => (
                <li key={idx}>
                  <strong>{overlap.apiary1.name}</strong> and{' '}
                  <strong>{overlap.apiary2.name}</strong>
                  <br />
                  Distance: {Math.round(overlap.distance_meters)}m
                  <br />
                  Overlap area: {Math.round(overlap.overlap_area_sq_meters)} m²
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
