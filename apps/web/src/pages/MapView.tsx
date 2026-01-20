import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import './MapView.css';

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
  const [mapContainer, setMapContainer] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  // Map initialization will be added when Leaflet is installed
  // useEffect(() => {
  //   if (mapContainer) {
  //     import('leaflet').then((L) => {
  //       const leafletMap = L.default.map(mapContainer).setView([51.505, -0.09], 13);
  //       L.default.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(leafletMap);
  //     });
  //   }
  // }, [mapContainer]);

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

      <div className="map-container" ref={setMapContainer}>
        {/* Map will be rendered here by Leaflet */}
        <div className="map-placeholder">
          <p>Map visualization requires Leaflet library</p>
          <p>Install: npm install leaflet react-leaflet @types/leaflet</p>
        </div>
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
