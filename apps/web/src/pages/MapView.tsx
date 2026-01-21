import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { LatLngBounds } from 'leaflet';
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

// Create green marker icon for selected apiaries
const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface Apiary {
  id: string;
  name: string;
  lat: number | string;
  lng: number | string;
  feeding_radius_m?: number;
  radius_color?: string;
}

interface Overlap {
  apiary1: Apiary;
  apiary2: Apiary;
  distance_meters: number;
  overlap_area_sq_meters: number;
}

// Component to auto-fit map bounds to show all apiaries with 10-mile buffer
function MapBoundsFitter({ apiaries }: { apiaries: Apiary[] }) {
  const map = useMap();

  useEffect(() => {
    if (apiaries.length === 0) return;

    const validApiaries = apiaries.filter(a => {
      const lat = typeof a.lat === 'string' ? parseFloat(a.lat) : a.lat;
      const lng = typeof a.lng === 'string' ? parseFloat(a.lng) : a.lng;
      return lat != null && lng != null && !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
    });

    if (validApiaries.length === 0) return;

    // Calculate bounds from all apiaries
    const lats = validApiaries.map(a => {
      const lat = typeof a.lat === 'string' ? parseFloat(a.lat) : a.lat;
      return lat as number;
    });
    const lngs = validApiaries.map(a => {
      const lng = typeof a.lng === 'string' ? parseFloat(a.lng) : a.lng;
      return lng as number;
    });

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    // Add 10-mile buffer (approximately 0.144 degrees at equator, adjust for latitude)
    // 10 miles ≈ 16,093 meters
    // At the equator, 1 degree ≈ 111,320 meters
    // So 10 miles ≈ 16,093 / 111,320 ≈ 0.144 degrees
    // Adjust for latitude: degrees = meters / (111,320 * cos(latitude))
    const centerLat = (minLat + maxLat) / 2;
    const latBuffer = 0.144; // Approximate buffer in degrees (works reasonably well for most latitudes)
    const lngBuffer = 0.144 / Math.cos((centerLat * Math.PI) / 180); // Adjust longitude buffer for latitude

    const bounds = new LatLngBounds(
      [minLat - latBuffer, minLng - lngBuffer],
      [maxLat + latBuffer, maxLng + lngBuffer]
    );

    // Fit bounds with padding
    map.fitBounds(bounds, {
      padding: [20, 20], // Add some padding so markers aren't at the edge
      maxZoom: 15 // Don't zoom in too close
    });
  }, [apiaries, map]);

  return null;
}

// Component to zoom to selected apiary with 1-mile radius
function MapZoomToApiary({ selectedApiary, apiaries }: { selectedApiary: string | null; apiaries: Apiary[] }) {
  const map = useMap();

  useEffect(() => {
    if (!selectedApiary) return;

    const apiary = apiaries.find(a => a.id === selectedApiary);
    if (!apiary) return;

    const lat = typeof apiary.lat === 'string' ? parseFloat(apiary.lat) : apiary.lat;
    const lng = typeof apiary.lng === 'string' ? parseFloat(apiary.lng) : apiary.lng;

    if (lat == null || lng == null || isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return;

    // 1 mile = 1609.34 meters
    const oneMileInMeters = 1609.34;
    
    // Calculate bounds for 1-mile radius
    // At the equator, 1 degree ≈ 111,320 meters
    // Adjust for latitude: degrees = meters / (111,320 * cos(latitude))
    const latOffset = oneMileInMeters / 111320;
    const lngOffset = oneMileInMeters / (111320 * Math.cos((lat * Math.PI) / 180));

    const bounds = new LatLngBounds(
      [lat - latOffset, lng - lngOffset],
      [lat + latOffset, lng + lngOffset]
    );

    // Fit bounds with padding
    map.fitBounds(bounds, {
      padding: [20, 20],
      maxZoom: 15
    });
  }, [selectedApiary, apiaries, map]);

  return null;
}

export default function MapView() {
  const [apiaries, setApiaries] = useState<Apiary[]>([]);
  const [overlaps, setOverlaps] = useState<Overlap[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOverlaps, setShowOverlaps] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>([51.505, -0.09]);
  const [mapZoom, setMapZoom] = useState(6);
  const [selectedApiaryId, setSelectedApiaryId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  // Set default map center (used when no apiaries are available)
  useEffect(() => {
    if (apiaries.length === 0) {
      // Default to UK center if no apiaries
      setMapCenter([51.505, -0.09]);
      setMapZoom(6);
    }
  }, [apiaries]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [apiariesRes, overlapsRes] = await Promise.all([
        api.get('/apiaries/map'),
        showOverlaps ? api.get('/apiaries/overlaps') : Promise.resolve({ data: { overlaps: [] } })
      ]);

      console.log('Map data received:', apiariesRes.data);
      console.log('Apiaries count:', apiariesRes.data.apiaries?.length);
      console.log('Apiaries data:', apiariesRes.data.apiaries);
      
      // Ensure coordinates are numbers and valid
      const validApiaries = (apiariesRes.data.apiaries || []).map((apiary: any) => ({
        ...apiary,
        lat: typeof apiary.lat === 'string' ? parseFloat(apiary.lat) : apiary.lat,
        lng: typeof apiary.lng === 'string' ? parseFloat(apiary.lng) : apiary.lng
      })).filter((apiary: any) => 
        apiary.lat != null && 
        apiary.lng != null && 
        !isNaN(apiary.lat) && 
        !isNaN(apiary.lng) &&
        apiary.lat !== 0 &&
        apiary.lng !== 0
      );
      
      console.log('Valid apiaries after filtering:', validApiaries);
      setApiaries(validApiaries);
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
        <div className="map-header-actions">
          <label className="overlap-toggle">
            <input
              type="checkbox"
              checked={showOverlaps}
              onChange={(e) => setShowOverlaps(e.target.checked)}
            />
            Show Feeding Radius Overlaps
          </label>
          <button onClick={loadData} className="btn-refresh" disabled={loading}>
            {loading ? 'Refreshing...' : '🔄 Refresh'}
          </button>
        </div>
      </div>

      <div className="map-container">
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
          <MapBoundsFitter apiaries={apiaries} />
          <MapZoomToApiary selectedApiary={selectedApiaryId} apiaries={apiaries} />
          {apiaries
            .filter(apiary => {
              const lat = typeof apiary.lat === 'string' ? parseFloat(apiary.lat) : apiary.lat;
              const lng = typeof apiary.lng === 'string' ? parseFloat(apiary.lng) : apiary.lng;
              return lat != null && lng != null && !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
            })
            .map((apiary) => {
              const lat = typeof apiary.lat === 'string' ? parseFloat(apiary.lat) : apiary.lat;
              const lng = typeof apiary.lng === 'string' ? parseFloat(apiary.lng) : apiary.lng;
              const isSelected = apiary.id === selectedApiaryId;
              return (
              <Marker 
                key={`marker-${apiary.id}-${isSelected}`} 
                position={[lat, lng]}
                icon={isSelected ? greenIcon : undefined}
              >
                <Popup>
                  <strong>{apiary.name}</strong>
                  {apiary.feeding_radius_m && (
                    <div>Feeding Radius: {apiary.feeding_radius_m}m</div>
                  )}
                </Popup>
              </Marker>
              );
            })}
          {apiaries
            .filter(apiary => {
              const lat = typeof apiary.lat === 'string' ? parseFloat(apiary.lat) : apiary.lat;
              const lng = typeof apiary.lng === 'string' ? parseFloat(apiary.lng) : apiary.lng;
              return lat != null && lng != null && !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0 && apiary.feeding_radius_m;
            })
            .map((apiary) => {
              const lat = typeof apiary.lat === 'string' ? parseFloat(apiary.lat) : apiary.lat;
              const lng = typeof apiary.lng === 'string' ? parseFloat(apiary.lng) : apiary.lng;
              const color = apiary.radius_color || '#3388ff';
              return (
              <Circle
                key={`circle-${apiary.id}`}
                center={[lat, lng]}
                radius={apiary.feeding_radius_m}
                pathOptions={{
                  color: showOverlaps ? '#ff0000' : color,
                  fillColor: showOverlaps ? '#ff0000' : color,
                  fillOpacity: 0.2,
                  weight: 2
                }}
              />
              );
            })}
        </MapContainer>
      </div>

      <div className="map-info">
        <div className="apiaries-list">
          <h3>Apiaries with Coordinates ({apiaries.length})</h3>
          {apiaries.length === 0 ? (
            <div>
              <p>No apiaries with coordinates found.</p>
              <p style={{ fontSize: '0.9rem', color: 'var(--gray-600)', marginTop: '0.5rem' }}>
                To see apiaries on the map, add coordinates when creating or editing an apiary.
              </p>
            </div>
          ) : (
            <ul>
              {apiaries.map((apiary) => (
                <li 
                  key={apiary.id}
                  className={apiary.id === selectedApiaryId ? 'selected' : ''}
                  onClick={() => setSelectedApiaryId(apiary.id === selectedApiaryId ? null : apiary.id)}
                >
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
