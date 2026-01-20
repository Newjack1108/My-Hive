import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './MapSelector.css';

// Fix for default marker icons in React-Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface MapSelectorProps {
  onSelect: (lat: number, lng: number) => void;
  onClose: () => void;
  initialLat?: number;
  initialLng?: number;
  initialRadius?: number;
  initialColor?: string;
}

// Component to handle map click events
function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      const { lat, lng } = e.latlng;
      onMapClick(lat, lng);
    },
  });
  return null;
}

export default function MapSelector({
  onSelect,
  onClose,
  initialLat,
  initialLng,
  initialRadius,
  initialColor
}: MapSelectorProps) {
  const [selectedLat, setSelectedLat] = useState<number | null>(initialLat || null);
  const [selectedLng, setSelectedLng] = useState<number | null>(initialLng || null);
  const [mapCenter, setMapCenter] = useState<[number, number]>(
    initialLat && initialLng ? [initialLat, initialLng] : [51.505, -0.09]
  );
  const [mapZoom, setMapZoom] = useState(initialLat && initialLng ? 12 : 6);

  useEffect(() => {
    if (initialLat && initialLng) {
      setSelectedLat(initialLat);
      setSelectedLng(initialLng);
      setMapCenter([initialLat, initialLng]);
      setMapZoom(12);
    }
  }, [initialLat, initialLng]);

  const handleMapClick = (lat: number, lng: number) => {
    setSelectedLat(lat);
    setSelectedLng(lng);
  };

  const handleConfirm = () => {
    if (selectedLat !== null && selectedLng !== null) {
      onSelect(selectedLat, selectedLng);
      onClose();
    }
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <div className="map-selector-overlay" onClick={handleCancel}>
      <div className="map-selector-modal" onClick={(e) => e.stopPropagation()}>
        <div className="map-selector-header">
          <h3>Select Location on Map</h3>
          <button onClick={handleCancel} className="map-selector-close">×</button>
        </div>
        <div className="map-selector-instructions">
          <p>Click on the map to select a location. The marker shows your selected position.</p>
          {selectedLat !== null && selectedLng !== null && (
            <p className="map-selector-coords">
              Selected: {selectedLat.toFixed(6)}, {selectedLng.toFixed(6)}
            </p>
          )}
        </div>
        <div className="map-selector-container">
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
            <MapClickHandler onMapClick={handleMapClick} />
            {selectedLat !== null && selectedLng !== null && (
              <>
                <Marker position={[selectedLat, selectedLng]}>
                  <Popup>
                    <div>
                      <strong>Selected Location</strong>
                      <br />
                      Lat: {selectedLat.toFixed(6)}
                      <br />
                      Lng: {selectedLng.toFixed(6)}
                    </div>
                  </Popup>
                </Marker>
                {initialRadius && (
                  <Circle
                    center={[selectedLat, selectedLng]}
                    radius={initialRadius}
                    pathOptions={{
                      color: initialColor || '#3388ff',
                      fillColor: initialColor || '#3388ff',
                      fillOpacity: 0.2,
                      weight: 2
                    }}
                  />
                )}
              </>
            )}
          </MapContainer>
        </div>
        <div className="map-selector-actions">
          <button onClick={handleCancel} className="btn-secondary">
            Cancel
          </button>
          <button 
            onClick={handleConfirm} 
            className="btn-primary"
            disabled={selectedLat === null || selectedLng === null}
          >
            Confirm Selection
          </button>
        </div>
      </div>
    </div>
  );
}
