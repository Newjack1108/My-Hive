import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { saveInspectionDraft, queueInspectionForSync, isOnline } from '../utils/offlineDb';
import { syncOfflineData } from '../utils/sync';
import './NewInspection.css';

interface InspectionSections {
  queen?: {
    present?: boolean;
    marked?: boolean;
    clipped?: boolean;
    notes?: string;
  };
  brood?: {
    frames?: number;
    pattern?: 'excellent' | 'good' | 'spotty' | 'poor';
    notes?: string;
  };
  strength?: {
    frames?: number;
    population?: 'strong' | 'moderate' | 'weak';
    notes?: string;
  };
  stores?: {
    honey?: 'heavy' | 'moderate' | 'light' | 'none';
    pollen?: 'heavy' | 'moderate' | 'light' | 'none';
    notes?: string;
  };
  temperament?: {
    rating?: 'calm' | 'moderate' | 'aggressive';
    notes?: string;
  };
  health?: {
    pests?: string[];
    diseases?: string[];
    notes?: string;
  };
}

export default function NewInspection() {
  const { hiveId } = useParams<{ hiveId: string }>();
  const navigate = useNavigate();
  const [hiveLabel, setHiveLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [location, setLocation] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
  } | null>(null);
  const [locationStatus, setLocationStatus] = useState<'requesting' | 'captured' | 'denied' | null>(null);
  const [currentSection, setCurrentSection] = useState<string>('queen');
  const [sections, setSections] = useState<InspectionSections>({});
  const [notes, setNotes] = useState('');
  const [clientUuid, setClientUuid] = useState<string | null>(null);
  const [startedAt] = useState(new Date().toISOString());
  const [online] = useState(isOnline());

  useEffect(() => {
    if (hiveId) {
      loadHive();
      requestLocation();
    }
  }, [hiveId]);

  // Auto-save draft every 10 seconds
  useEffect(() => {
    if (!hiveId || !clientUuid) return;

    const interval = setInterval(() => {
      saveDraft();
    }, 10000);

    return () => clearInterval(interval);
  }, [hiveId, clientUuid, sections, notes, location]);

  const loadHive = async () => {
    try {
      const res = await api.get(`/hives/${hiveId}`);
      setHiveLabel(res.data.hive.label);
    } catch (error) {
      console.error('Failed to load hive:', error);
    } finally {
      setLoading(false);
    }
  };

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('denied');
      return;
    }

    setLocationStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy || 0,
        });
        setLocationStatus('captured');
      },
      () => {
        setLocationStatus('denied');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  };

  const saveDraft = async () => {
    if (!hiveId) return;

    try {
      const uuid = await saveInspectionDraft({
        hive_id: hiveId,
        started_at: startedAt,
        location_lat: location?.lat || null,
        location_lng: location?.lng || null,
        location_accuracy_m: location ? location.accuracy : null,
        sections_json: sections,
        notes,
      });

      if (!clientUuid) {
        setClientUuid(uuid);
      }
    } catch (error) {
      console.error('Failed to save draft:', error);
    }
  };

  const updateSection = (section: string, data: any) => {
    setSections((prev) => ({
      ...prev,
      [section]: { ...prev[section as keyof InspectionSections], ...data },
    }));
  };

  const handleFinish = async () => {
    if (!hiveId || !clientUuid) return;

    setSaving(true);

    try {
      // Final save with ended_at
      const endedAt = new Date().toISOString();
      
      const inspectionData = {
        hive_id: hiveId,
        started_at: startedAt,
        ended_at: endedAt,
        location_lat: location?.lat || null,
        location_lng: location?.lng || null,
        location_accuracy_m: location ? location.accuracy : null,
        sections_json: sections,
        notes,
        client_uuid: clientUuid,
      };

      if (online) {
        // Try to sync immediately
        try {
          await api.post('/inspections', inspectionData);
          // Sync successful
          navigate(`/hives/${hiveId}`);
          return;
        } catch (error) {
          console.error('Sync failed, queueing for later:', error);
        }
      }

      // Queue for offline sync
      await saveInspectionDraft({
        ...inspectionData,
        ended_at: endedAt,
      });
      await queueInspectionForSync(clientUuid);

      // Try sync if online
      if (online) {
        await syncOfflineData();
      }

      navigate(`/hives/${hiveId}`);
    } catch (error) {
      console.error('Failed to finish inspection:', error);
      alert('Failed to save inspection. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const sectionButtons = [
    { id: 'queen', label: 'Queen', icon: '/queen-icon.png' },
    { id: 'brood', label: 'Brood' },
    { id: 'strength', label: 'Strength' },
    { id: 'stores', label: 'Stores' },
    { id: 'temperament', label: 'Temperament' },
    { id: 'health', label: 'Health' },
    { id: 'notes', label: 'Notes' },
  ];

  if (loading) {
    return <div className="inspection-loading">Loading...</div>;
  }

  return (
    <div className="inspection-wizard">
      <div className="inspection-header">
        <h2>New Inspection: {hiveLabel}</h2>
        <div className="inspection-meta">
          <div className={`location-badge ${locationStatus === 'captured' ? 'captured' : ''}`}>
            {locationStatus === 'captured' ? '📍 Location captured' : '📍 No location'}
          </div>
          <div className={`sync-badge ${online ? 'online' : 'offline'}`}>
            {online ? '🟢 Online' : '🔴 Offline'}
          </div>
        </div>
      </div>

      <div className="inspection-sections-nav">
        {sectionButtons.map((btn) => (
          <button
            key={btn.id}
            onClick={() => setCurrentSection(btn.id)}
            className={`section-btn ${currentSection === btn.id ? 'active' : ''}`}
          >
            {btn.icon && <img src={btn.icon} alt="" className="section-icon" />}
            {btn.label}
          </button>
        ))}
      </div>

      <div className="inspection-content">
        {currentSection === 'queen' && (
          <QueenSection
            data={sections.queen}
            onChange={(data) => updateSection('queen', data)}
          />
        )}
        {currentSection === 'brood' && (
          <BroodSection
            data={sections.brood}
            onChange={(data) => updateSection('brood', data)}
          />
        )}
        {currentSection === 'strength' && (
          <StrengthSection
            data={sections.strength}
            onChange={(data) => updateSection('strength', data)}
          />
        )}
        {currentSection === 'stores' && (
          <StoresSection
            data={sections.stores}
            onChange={(data) => updateSection('stores', data)}
          />
        )}
        {currentSection === 'temperament' && (
          <TemperamentSection
            data={sections.temperament}
            onChange={(data) => updateSection('temperament', data)}
          />
        )}
        {currentSection === 'health' && (
          <HealthSection
            data={sections.health}
            onChange={(data) => updateSection('health', data)}
          />
        )}
        {currentSection === 'notes' && (
          <NotesSection
            notes={notes}
            onChange={setNotes}
          />
        )}
      </div>

      <div className="inspection-actions">
        <button onClick={() => navigate(-1)} className="btn-secondary btn-large">
          Cancel
        </button>
        <button
          onClick={handleFinish}
          disabled={saving}
          className="btn-primary btn-large"
        >
          {saving ? 'Saving...' : 'Finish Inspection'}
        </button>
      </div>
    </div>
  );
}

// Section components
function QueenSection({ data, onChange }: { data?: any; onChange: (data: any) => void }) {
  return (
    <div className="inspection-section">
      <h3>Queen Status</h3>
      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={data?.present || false}
            onChange={(e) => onChange({ present: e.target.checked })}
            className="large-checkbox"
          />
          <span>Queen Present</span>
        </label>
      </div>
      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={data?.marked || false}
            onChange={(e) => onChange({ marked: e.target.checked })}
            className="large-checkbox"
          />
          <span>Queen Marked</span>
        </label>
      </div>
      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={data?.clipped || false}
            onChange={(e) => onChange({ clipped: e.target.checked })}
            className="large-checkbox"
          />
          <span>Queen Clipped</span>
        </label>
      </div>
      <div className="form-group">
        <label>Notes</label>
        <textarea
          value={data?.notes || ''}
          onChange={(e) => onChange({ notes: e.target.value })}
          rows={4}
          placeholder="Additional notes about the queen..."
        />
      </div>
    </div>
  );
}

function BroodSection({ data, onChange }: { data?: any; onChange: (data: any) => void }) {
  return (
    <div className="inspection-section">
      <h3>Brood</h3>
      <div className="form-group">
        <label>Number of Frames (0-10)</label>
        <input
          type="number"
          min="0"
          max="10"
          value={data?.frames || ''}
          onChange={(e) => onChange({ frames: parseInt(e.target.value) || undefined })}
          className="number-input"
        />
      </div>
      <div className="form-group">
        <label>Pattern</label>
        <div className="button-group">
          {['excellent', 'good', 'spotty', 'poor'].map((pattern) => (
            <button
              key={pattern}
              type="button"
              onClick={() => onChange({ pattern })}
              className={`option-btn ${data?.pattern === pattern ? 'active' : ''}`}
            >
              {pattern.charAt(0).toUpperCase() + pattern.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="form-group">
        <label>Notes</label>
        <textarea
          value={data?.notes || ''}
          onChange={(e) => onChange({ notes: e.target.value })}
          rows={4}
          placeholder="Brood notes..."
        />
      </div>
    </div>
  );
}

function StrengthSection({ data, onChange }: { data?: any; onChange: (data: any) => void }) {
  return (
    <div className="inspection-section">
      <h3>Colony Strength</h3>
      <div className="form-group">
        <label>Number of Frames (0-10)</label>
        <input
          type="number"
          min="0"
          max="10"
          value={data?.frames || ''}
          onChange={(e) => onChange({ frames: parseInt(e.target.value) || undefined })}
          className="number-input"
        />
      </div>
      <div className="form-group">
        <label>Population</label>
        <div className="button-group">
          {['strong', 'moderate', 'weak'].map((pop) => (
            <button
              key={pop}
              type="button"
              onClick={() => onChange({ population: pop })}
              className={`option-btn ${data?.population === pop ? 'active' : ''}`}
            >
              {pop.charAt(0).toUpperCase() + pop.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="form-group">
        <label>Notes</label>
        <textarea
          value={data?.notes || ''}
          onChange={(e) => onChange({ notes: e.target.value })}
          rows={4}
          placeholder="Strength notes..."
        />
      </div>
    </div>
  );
}

function StoresSection({ data, onChange }: { data?: any; onChange: (data: any) => void }) {
  return (
    <div className="inspection-section">
      <h3>Food Stores</h3>
      <div className="form-group">
        <label>Honey</label>
        <div className="button-group">
          {['heavy', 'moderate', 'light', 'none'].map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => onChange({ honey: level })}
              className={`option-btn ${data?.honey === level ? 'active' : ''}`}
            >
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="form-group">
        <label>Pollen</label>
        <div className="button-group">
          {['heavy', 'moderate', 'light', 'none'].map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => onChange({ pollen: level })}
              className={`option-btn ${data?.pollen === level ? 'active' : ''}`}
            >
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="form-group">
        <label>Notes</label>
        <textarea
          value={data?.notes || ''}
          onChange={(e) => onChange({ notes: e.target.value })}
          rows={4}
          placeholder="Stores notes..."
        />
      </div>
    </div>
  );
}

function TemperamentSection({ data, onChange }: { data?: any; onChange: (data: any) => void }) {
  const temperamentOptions = [
    { value: 'calm', label: 'Calm', icon: '/temperament-happy-icon.png' },
    { value: 'moderate', label: 'Moderate', icon: '/temperament-neutral-icon.png' },
    { value: 'aggressive', label: 'Aggressive', icon: '/temperament-angry-icon.png' },
  ];

  return (
    <div className="inspection-section">
      <h3>Temperament</h3>
      <div className="form-group">
        <label>Rating</label>
        <div className="button-group">
          {temperamentOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange({ rating: option.value })}
              className={`option-btn temperament-btn ${data?.rating === option.value ? 'active' : ''}`}
            >
              <img src={option.icon} alt="" className="temperament-icon" />
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="form-group">
        <label>Notes</label>
        <textarea
          value={data?.notes || ''}
          onChange={(e) => onChange({ notes: e.target.value })}
          rows={4}
          placeholder="Temperament notes..."
        />
      </div>
    </div>
  );
}

function HealthSection({ data, onChange }: { data?: any; onChange: (data: any) => void }) {
  const [pestInput, setPestInput] = useState('');

  const addPest = () => {
    if (pestInput.trim()) {
      onChange({
        pests: [...(data?.pests || []), pestInput.trim()],
      });
      setPestInput('');
    }
  };

  const removePest = (index: number) => {
    const pests = [...(data?.pests || [])];
    pests.splice(index, 1);
    onChange({ pests });
  };

  return (
    <div className="inspection-section">
      <h3>Health & Pests</h3>
      <div className="form-group">
        <label>Pests Observed</label>
        <div className="tag-input-group">
          <input
            type="text"
            value={pestInput}
            onChange={(e) => setPestInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addPest())}
            placeholder="Type and press Enter"
          />
          <button type="button" onClick={addPest} className="btn-small">
            Add
          </button>
        </div>
        <div className="tag-list">
          {(data?.pests || []).map((pest: string, index: number) => (
            <span key={index} className="tag">
              {pest}
              <button
                type="button"
                onClick={() => removePest(index)}
                className="tag-remove"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>
      <div className="form-group">
        <label>Diseases Observed</label>
        <textarea
          value={data?.diseases?.join(', ') || ''}
          onChange={(e) =>
            onChange({
              diseases: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
            })
          }
          rows={3}
          placeholder="List diseases separated by commas"
        />
      </div>
      <div className="form-group">
        <label>Health Notes</label>
        <textarea
          value={data?.notes || ''}
          onChange={(e) => onChange({ notes: e.target.value })}
          rows={4}
          placeholder="Health observations..."
        />
      </div>
    </div>
  );
}

function NotesSection({ notes, onChange }: { notes: string; onChange: (notes: string) => void }) {
  return (
    <div className="inspection-section">
      <h3>General Notes</h3>
      <div className="form-group">
        <textarea
          value={notes}
          onChange={(e) => onChange(e.target.value)}
          rows={10}
          placeholder="Additional notes about this inspection..."
          className="notes-textarea"
        />
      </div>
    </div>
  );
}
