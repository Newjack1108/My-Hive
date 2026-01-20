import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import './ApiariesList.css';

interface Apiary {
  id: string;
  name: string;
  description?: string;
  lat?: number;
  lng?: number;
  feeding_radius_m?: number;
}

interface Hive {
  id: string;
  public_id: string;
  label: string;
  apiary_id?: string;
}

interface EditFormData {
  name: string;
  description: string;
  lat: string;
  lng: string;
  feeding_radius_m: string;
}

export default function ApiariesList() {
  const { user } = useAuth();
  const [apiaries, setApiaries] = useState<Apiary[]>([]);
  const [hives, setHives] = useState<Hive[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFormData>({
    name: '',
    description: '',
    lat: '',
    lng: '',
    feeding_radius_m: ''
  });
  const [gettingLocation, setGettingLocation] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showCreateApiary, setShowCreateApiary] = useState(false);
  const [createApiaryForm, setCreateApiaryForm] = useState<EditFormData>({
    name: '',
    description: '',
    lat: '',
    lng: '',
    feeding_radius_m: ''
  });
  const [gettingCreateLocation, setGettingCreateLocation] = useState(false);
  const [createApiaryError, setCreateApiaryError] = useState<string | null>(null);
  const [createApiarySuccess, setCreateApiarySuccess] = useState(false);
  const [showCreateHive, setShowCreateHive] = useState(false);
  const [createHiveForm, setCreateHiveForm] = useState({
    public_id: '',
    label: '',
    apiary_id: '',
    status: 'active' as 'active' | 'inactive' | 'retired'
  });
  const [createHiveError, setCreateHiveError] = useState<string | null>(null);
  const [createHiveSuccess, setCreateHiveSuccess] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [apiariesRes, hivesRes] = await Promise.all([
        api.get('/apiaries'),
        api.get('/hives'),
      ]);

      setApiaries(apiariesRes.data.apiaries);
      setHives(hivesRes.data.hives);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (apiary: Apiary) => {
    setEditingId(apiary.id);
    setEditForm({
      name: apiary.name,
      description: apiary.description || '',
      lat: apiary.lat?.toString() || '',
      lng: apiary.lng?.toString() || '',
      feeding_radius_m: apiary.feeding_radius_m?.toString() || ''
    });
    setSaveError(null);
    setSaveSuccess(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({
      name: '',
      description: '',
      lat: '',
      lng: '',
      feeding_radius_m: ''
    });
    setSaveError(null);
    setSaveSuccess(false);
  };

  const getCurrentLocation = (forCreate: boolean = false) => {
    if (!navigator.geolocation) {
      if (forCreate) {
        setCreateApiaryError('Geolocation is not supported by your browser');
      } else {
        setSaveError('Geolocation is not supported by your browser');
      }
      return;
    }

    if (forCreate) {
      setGettingCreateLocation(true);
      setCreateApiaryError(null);
    } else {
      setGettingLocation(true);
      setSaveError(null);
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (forCreate) {
          setCreateApiaryForm({
            ...createApiaryForm,
            lat: position.coords.latitude.toString(),
            lng: position.coords.longitude.toString()
          });
          setGettingCreateLocation(false);
        } else {
          setEditForm({
            ...editForm,
            lat: position.coords.latitude.toString(),
            lng: position.coords.longitude.toString()
          });
          setGettingLocation(false);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        const errorMsg = 'Failed to get location: ' + error.message;
        if (forCreate) {
          setCreateApiaryError(errorMsg);
          setGettingCreateLocation(false);
        } else {
          setSaveError(errorMsg);
          setGettingLocation(false);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const handleSave = async () => {
    if (!editingId) return;

    try {
      setSaveError(null);
      setSaveSuccess(false);

      const updateData: any = {
        name: editForm.name,
        description: editForm.description || undefined
      };

      if (editForm.lat && editForm.lat.trim() !== '') {
        const lat = parseFloat(editForm.lat);
        if (!isNaN(lat)) {
          updateData.lat = lat;
        }
      }
      if (editForm.lng && editForm.lng.trim() !== '') {
        const lng = parseFloat(editForm.lng);
        if (!isNaN(lng)) {
          updateData.lng = lng;
        }
      }
      if (editForm.feeding_radius_m) {
        updateData.feeding_radius_m = parseFloat(editForm.feeding_radius_m);
      }

      await api.patch(`/apiaries/${editingId}`, updateData);
      setSaveSuccess(true);
      setTimeout(() => {
        cancelEdit();
        loadData();
      }, 1000);
    } catch (error: any) {
      console.error('Failed to update apiary:', error);
      setSaveError(error.response?.data?.error || 'Failed to update apiary');
    }
  };

  const handleCreateApiary = async () => {
    try {
      setCreateApiaryError(null);
      setCreateApiarySuccess(false);

      const createData: any = {
        name: createApiaryForm.name,
        description: createApiaryForm.description || undefined
      };

      if (createApiaryForm.lat && createApiaryForm.lat.trim() !== '') {
        const lat = parseFloat(createApiaryForm.lat);
        if (!isNaN(lat)) {
          createData.lat = lat;
        }
      }
      if (createApiaryForm.lng && createApiaryForm.lng.trim() !== '') {
        const lng = parseFloat(createApiaryForm.lng);
        if (!isNaN(lng)) {
          createData.lng = lng;
        }
      }
      if (createApiaryForm.feeding_radius_m) {
        createData.feeding_radius_m = parseFloat(createApiaryForm.feeding_radius_m);
      }

      await api.post('/apiaries', createData);
      setCreateApiarySuccess(true);
      setTimeout(() => {
        setShowCreateApiary(false);
        setCreateApiaryForm({
          name: '',
          description: '',
          lat: '',
          lng: '',
          feeding_radius_m: ''
        });
        loadData();
      }, 1000);
    } catch (error: any) {
      console.error('Failed to create apiary:', error);
      setCreateApiaryError(error.response?.data?.error || 'Failed to create apiary');
    }
  };

  const handleCreateHive = async () => {
    try {
      setCreateHiveError(null);
      setCreateHiveSuccess(false);

      const createData: any = {
        public_id: createHiveForm.public_id,
        label: createHiveForm.label,
        status: createHiveForm.status
      };

      if (createHiveForm.apiary_id) {
        createData.apiary_id = createHiveForm.apiary_id;
      }

      await api.post('/hives', createData);
      setCreateHiveSuccess(true);
      setTimeout(() => {
        setShowCreateHive(false);
        setCreateHiveForm({
          public_id: '',
          label: '',
          apiary_id: '',
          status: 'active'
        });
        loadData();
      }, 1000);
    } catch (error: any) {
      console.error('Failed to create hive:', error);
      setCreateHiveError(error.response?.data?.error || 'Failed to create hive');
    }
  };

  if (loading) {
    return <div className="apiaries-loading">Loading...</div>;
  }

  return (
    <div className="apiaries-list">
      <div className="page-header">
        <img src="/apiary-icon.png" alt="" className="page-icon" />
        <h2>Apiaries</h2>
        {(user?.role === 'admin' || user?.role === 'manager') && (
          <div className="page-actions">
            <button onClick={() => setShowCreateApiary(true)} className="btn-primary">
              + Create Apiary
            </button>
            <button onClick={() => setShowCreateHive(true)} className="btn-primary">
              + Create Hive
            </button>
          </div>
        )}
      </div>

      {showCreateApiary && (
        <div className="create-form-container">
          <div className="apiary-edit-form">
            <h3>Create New Apiary</h3>
            <div className="form-group">
              <label>Name *</label>
              <input
                type="text"
                value={createApiaryForm.name}
                onChange={(e) => setCreateApiaryForm({ ...createApiaryForm, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                value={createApiaryForm.description}
                onChange={(e) => setCreateApiaryForm({ ...createApiaryForm, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={createApiaryForm.lat}
                  onChange={(e) => setCreateApiaryForm({ ...createApiaryForm, lat: e.target.value })}
                  placeholder="e.g., 51.5074"
                />
              </div>
              <div className="form-group">
                <label>Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={createApiaryForm.lng}
                  onChange={(e) => setCreateApiaryForm({ ...createApiaryForm, lng: e.target.value })}
                  placeholder="e.g., -0.1278"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => getCurrentLocation(true)}
              disabled={gettingCreateLocation}
              className="btn-location"
            >
              {gettingCreateLocation ? 'Getting Location...' : '📍 Get Current Location'}
            </button>
            <div className="form-group">
              <label>Feeding Radius (meters)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={createApiaryForm.feeding_radius_m}
                onChange={(e) => setCreateApiaryForm({ ...createApiaryForm, feeding_radius_m: e.target.value })}
                placeholder="e.g., 5000"
              />
            </div>
            {createApiaryError && (
              <div className="error-message">{createApiaryError}</div>
            )}
            {createApiarySuccess && (
              <div className="success-message">Apiary created successfully!</div>
            )}
            <div className="form-actions">
              <button onClick={handleCreateApiary} className="btn-primary">
                Create
              </button>
              <button
                onClick={() => {
                  setShowCreateApiary(false);
                  setCreateApiaryForm({
                    name: '',
                    description: '',
                    lat: '',
                    lng: '',
                    feeding_radius_m: ''
                  });
                  setCreateApiaryError(null);
                  setCreateApiarySuccess(false);
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateHive && (
        <div className="create-form-container">
          <div className="apiary-edit-form">
            <h3>Create New Hive</h3>
            <div className="form-group">
              <label>Public ID *</label>
              <input
                type="text"
                value={createHiveForm.public_id}
                onChange={(e) => setCreateHiveForm({ ...createHiveForm, public_id: e.target.value })}
                placeholder="e.g., HIVE-001"
                required
                maxLength={50}
              />
              <small>Unique identifier for the hive (used in URLs)</small>
            </div>
            <div className="form-group">
              <label>Label *</label>
              <input
                type="text"
                value={createHiveForm.label}
                onChange={(e) => setCreateHiveForm({ ...createHiveForm, label: e.target.value })}
                placeholder="e.g., Main Hive 1"
                required
                maxLength={255}
              />
            </div>
            <div className="form-group">
              <label>Apiary</label>
              <select
                value={createHiveForm.apiary_id}
                onChange={(e) => setCreateHiveForm({ ...createHiveForm, apiary_id: e.target.value })}
              >
                <option value="">None (unassigned)</option>
                {apiaries.map((apiary) => (
                  <option key={apiary.id} value={apiary.id}>
                    {apiary.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Status</label>
              <select
                value={createHiveForm.status}
                onChange={(e) => setCreateHiveForm({ ...createHiveForm, status: e.target.value as any })}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="retired">Retired</option>
              </select>
            </div>
            {createHiveError && (
              <div className="error-message">{createHiveError}</div>
            )}
            {createHiveSuccess && (
              <div className="success-message">Hive created successfully!</div>
            )}
            <div className="form-actions">
              <button onClick={handleCreateHive} className="btn-primary">
                Create
              </button>
              <button
                onClick={() => {
                  setShowCreateHive(false);
                  setCreateHiveForm({
                    public_id: '',
                    label: '',
                    apiary_id: '',
                    status: 'active'
                  });
                  setCreateHiveError(null);
                  setCreateHiveSuccess(false);
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {apiaries.length === 0 ? (
        <p className="empty-state">No apiaries yet</p>
      ) : (
        <div className="apiaries-grid">
          {apiaries.map((apiary) => {
            const apiaryHives = hives.filter((h) => h.apiary_id === apiary.id);
            const isEditing = editingId === apiary.id;
            const hasCoordinates = apiary.lat !== null && apiary.lat !== undefined && 
                                   apiary.lng !== null && apiary.lng !== undefined;
            const canEdit = user?.role === 'admin' || user?.role === 'manager';

            return (
              <div key={apiary.id} className="apiary-card">
                {!isEditing ? (
                  <>
                    <div className="apiary-header">
                      <h3>{apiary.name}</h3>
                      {canEdit && (
                        <button onClick={() => startEdit(apiary)} className="btn-edit">
                          <img src="/edit-icon.png" alt="Edit" className="icon-inline" />
                          Edit
                        </button>
                      )}
                    </div>
                    {apiary.description && <p className="apiary-description">{apiary.description}</p>}
                    {hasCoordinates ? (
                      <p className="apiary-location has-coordinates">
                        <img src="/map-icon.png" alt="" className="icon-inline" />
                        {Number(apiary.lat).toFixed(4)}, {Number(apiary.lng).toFixed(4)}
                        <Link to="/map" className="view-on-map-link">View on Map</Link>
                      </p>
                    ) : (
                      <p className="apiary-location no-coordinates">
                        <img src="/map-icon.png" alt="" className="icon-inline" />
                        No coordinates set
                      </p>
                    )}
                    {apiary.feeding_radius_m && (
                      <p className="apiary-radius">
                        Feeding Radius: {apiary.feeding_radius_m}m
                      </p>
                    )}
                    <div className="apiary-stats">
                      <span>{apiaryHives.length} hive(s)</span>
                    </div>
                    <div className="apiary-hives">
                      {apiaryHives.map((hive) => (
                        <Link
                          key={hive.id}
                          to={`/hives/${hive.id}`}
                          className="hive-link"
                        >
                          <img src="/hive-icon.png" alt="" className="icon-inline" />
                          {hive.label} ({hive.public_id})
                        </Link>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="apiary-edit-form">
                    <h3>Edit Apiary</h3>
                    <div className="form-group">
                      <label>Name *</label>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Description</label>
                      <textarea
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        rows={3}
                      />
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Latitude</label>
                        <input
                          type="number"
                          step="any"
                          value={editForm.lat}
                          onChange={(e) => setEditForm({ ...editForm, lat: e.target.value })}
                          placeholder="e.g., 51.5074"
                        />
                      </div>
                      <div className="form-group">
                        <label>Longitude</label>
                        <input
                          type="number"
                          step="any"
                          value={editForm.lng}
                          onChange={(e) => setEditForm({ ...editForm, lng: e.target.value })}
                          placeholder="e.g., -0.1278"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => getCurrentLocation(false)}
                      disabled={gettingLocation}
                      className="btn-location"
                    >
                      {gettingLocation ? 'Getting Location...' : '📍 Get Current Location'}
                    </button>
                    <div className="form-group">
                      <label>Feeding Radius (meters)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editForm.feeding_radius_m}
                        onChange={(e) => setEditForm({ ...editForm, feeding_radius_m: e.target.value })}
                        placeholder="e.g., 5000"
                      />
                    </div>
                    {saveError && (
                      <div className="error-message">{saveError}</div>
                    )}
                    {saveSuccess && (
                      <div className="success-message">Apiary updated successfully!</div>
                    )}
                    <div className="form-actions">
                      <button onClick={handleSave} className="btn-primary">
                        Save
                      </button>
                      <button onClick={cancelEdit} className="btn-secondary">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="all-hives-section">
        <h3>All Hives</h3>
        {hives.length === 0 ? (
          <p className="empty-state">No hives yet</p>
        ) : (
          <div className="hives-list">
            {hives.map((hive) => (
              <Link key={hive.id} to={`/hives/${hive.id}`} className="hive-item">
                <img src="/hive-icon.png" alt="" className="hive-item-icon" />
                <div className="hive-item-label">{hive.label}</div>
                <div className="hive-item-id">{hive.public_id}</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
