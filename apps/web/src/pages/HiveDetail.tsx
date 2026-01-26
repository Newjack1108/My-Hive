import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import WeatherDisplay from '../components/WeatherDisplay';
import PhotoUpload from '../components/PhotoUpload';
import AuthenticatedImage from '../components/AuthenticatedImage';
import { WeatherData, InspectionSections } from '@my-hive/shared';
import './HiveDetail.css';

interface Hive {
  id: string;
  public_id: string;
  label: string;
  status: string;
  apiary_id?: string;
  apiary_name?: string;
}

interface Apiary {
  id: string;
  name: string;
}

interface Inspection {
  id: string;
  started_at: string;
  ended_at?: string;
  notes?: string;
  inspector_name?: string;
  weather_json?: string | WeatherData;
  location_lat?: string;
  location_lng?: string;
  sections_json?: InspectionSections | string;
}

interface Task {
  id: string;
  title: string;
  due_date: string;
  status: string;
}

interface HoneyHarvest {
  id: string;
  harvest_date: string;
  weight_kg: number;
  frames?: number;
}

interface Queen {
  id: string;
  name?: string;
  status: string;
  birth_date?: string;
}

interface MaintenanceSchedule {
  id: string;
  name: string;
  next_due_date: string;
  template_name?: string;
}

interface MaintenanceHistory {
  id: string;
  completed_date: string;
  notes?: string;
  schedule_name?: string;
  completed_by_name?: string;
}

interface Photo {
  id: string;
  url: string;
  thumbnail_url: string;
  width?: number;
  height?: number;
  created_at: string;
}

interface InspectionPhoto {
  id: string;
  storage_key?: string;
  thumbnail_storage_key?: string;
  width?: number;
  height?: number;
  bytes?: number;
  mime_type?: string;
  created_at: string;
}

interface Treatment {
  id: string;
  type: string;
  product: string;
  batch?: string;
  dose?: string;
  method?: string;
  withdrawal_end_date?: string;
}

interface FullInspection extends Inspection {
  sections_json?: InspectionSections | string;
  photos?: InspectionPhoto[];
  treatments?: Treatment[];
}

// Helper function to parse notes that may be JSON with original_notes
function parseNotes(notes: string | undefined | null): string | null {
  if (!notes) return null;
  
  try {
    const parsed = JSON.parse(notes);
    if (parsed && typeof parsed === 'object' && 'original_notes' in parsed) {
      return parsed.original_notes || null;
    }
  } catch {
    // Not JSON, return as-is
  }
  
  return notes;
}

// Helper function to parse sections_json
function parseSections(sections: InspectionSections | string | undefined): InspectionSections | null {
  if (!sections) return null;
  
  if (typeof sections === 'string') {
    try {
      return JSON.parse(sections);
    } catch {
      return null;
    }
  }
  
  return sections;
}

// Helper function to capitalize first letter
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Helper function to format duration
function formatDuration(started: string, ended?: string): string | null {
  if (!ended) return null;
  
  const start = new Date(started);
  const end = new Date(ended);
  const diffMs = end.getTime() - start.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 60) {
    return `${diffMins} minutes`;
  }
  
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export default function HiveDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [hive, setHive] = useState<Hive | null>(null);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [harvests, setHarvests] = useState<HoneyHarvest[]>([]);
  const [queens, setQueens] = useState<Queen[]>([]);
  const [apiaries, setApiaries] = useState<Apiary[]>([]);
  const [maintenanceSchedules, setMaintenanceSchedules] = useState<MaintenanceSchedule[]>([]);
  const [maintenanceHistory, setMaintenanceHistory] = useState<MaintenanceHistory[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    label: '',
    apiary_id: '',
    status: 'active' as 'active' | 'inactive' | 'retired'
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<FullInspection | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inspectionLoading, setInspectionLoading] = useState(false);
  const [inspectionError, setInspectionError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadHive();
    }
  }, [id]);

  const loadHive = async () => {
    try {
      setLoading(true);
      const [hiveRes, harvestsRes, queensRes, apiariesRes, maintenanceSchedulesRes, maintenanceHistoryRes] = await Promise.all([
        api.get(`/hives/${id}`),
        api.get(`/honey/harvests?hive_id=${id}`),
        api.get(`/queens?hive_id=${id}`),
        api.get('/apiaries'),
        api.get(`/maintenance/schedules?hive_id=${id}&active=true`).catch(() => ({ data: { schedules: [] } })),
        api.get(`/maintenance/history?hive_id=${id}`).catch(() => ({ data: { history: [] } }))
      ]);
      setHive(hiveRes.data.hive);
      setInspections(hiveRes.data.inspections || []);
      setTasks(hiveRes.data.tasks || []);
      setHarvests(harvestsRes.data.harvests || []);
      setQueens(queensRes.data.queens || []);
      setApiaries(apiariesRes.data.apiaries);
      setMaintenanceSchedules(maintenanceSchedulesRes.data.schedules || []);
      setMaintenanceHistory(maintenanceHistoryRes.data.history || []);
      setPhotos(hiveRes.data.photos || []);
    } catch (error) {
      console.error('Failed to load hive:', error);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = () => {
    if (!hive) return;
    setIsEditing(true);
    setEditForm({
      label: hive.label,
      apiary_id: hive.apiary_id || '',
      status: hive.status as 'active' | 'inactive' | 'retired'
    });
    setEditError(null);
    setEditSuccess(false);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditForm({
      label: '',
      apiary_id: '',
      status: 'active'
    });
    setEditError(null);
    setEditSuccess(false);
  };

  const handleSave = async () => {
    if (!id) return;

    try {
      setEditError(null);
      setEditSuccess(false);

      const updateData: any = {
        label: editForm.label,
        status: editForm.status
      };

      if (editForm.apiary_id) {
        updateData.apiary_id = editForm.apiary_id;
      } else {
        updateData.apiary_id = null;
      }

      await api.patch(`/hives/${id}`, updateData);
      setEditSuccess(true);
      setTimeout(() => {
        cancelEdit();
        loadHive();
      }, 1000);
    } catch (error: any) {
      console.error('Failed to update hive:', error);
      setEditError(error.response?.data?.error || 'Failed to update hive');
    }
  };

  const handleCompleteMaintenance = async (scheduleId: string) => {
    if (!id) return;
    try {
      await api.post(`/maintenance/schedules/${scheduleId}/complete`, {
        hive_id: id,
        completed_date: new Date().toISOString().split('T')[0],
        notes: 'Completed from hive detail page'
      });
      loadHive();
    } catch (error: any) {
      console.error('Failed to complete maintenance:', error);
      alert(error.response?.data?.error || 'Failed to complete maintenance');
    }
  };

  const handleInspectionClick = async (inspectionId: string) => {
    try {
      setInspectionLoading(true);
      setInspectionError(null);
      const res = await api.get(`/inspections/${inspectionId}`);
      // Combine inspection with photos and treatments from API response
      const fullInspection: FullInspection = {
        ...res.data.inspection,
        photos: res.data.photos || [],
        treatments: res.data.treatments || []
      };
      setSelectedInspection(fullInspection);
      setIsModalOpen(true);
    } catch (error: any) {
      console.error('Failed to load inspection details:', error);
      setInspectionError(error.response?.data?.error || 'Failed to load inspection details');
    } finally {
      setInspectionLoading(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedInspection(null);
    setInspectionError(null);
  };

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isModalOpen) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isModalOpen]);

  if (loading) {
    return <div className="hive-detail-loading">Loading...</div>;
  }

  if (!hive) {
    return <div className="hive-detail-error">Hive not found</div>;
  }

  return (
    <div className="hive-detail">
      <div className="hive-detail-header">
        {!isEditing ? (
          <>
            <div className="hive-header-title">
              <img src="/hive-icon.png" alt="" className="hive-header-icon" />
              <h2>{hive.label}</h2>
              {(user?.role === 'admin' || user?.role === 'manager') && (
                <button onClick={startEdit} className="btn-edit">
                  <img src="/edit-icon.png" alt="Edit" className="icon-inline" />
                  Edit
                </button>
              )}
            </div>
            <div className="hive-meta-info">
              <span className="hive-id">
                <img src="/hive-icon.png" alt="" className="icon-inline" />
                ID: {hive.public_id}
              </span>
              {hive.apiary_name && (
                <span>
                  <img src="/map-icon.png" alt="" className="icon-inline" />
                  {hive.apiary_name}
                </span>
              )}
              <span className={`status-badge status-${hive.status}`}>{hive.status}</span>
            </div>
          </>
        ) : (
          <div className="hive-edit-form">
            <h3>Edit Hive</h3>
            <div className="form-group">
              <label>Label *</label>
              <input
                type="text"
                value={editForm.label}
                onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                required
                maxLength={255}
              />
            </div>
            <div className="form-group">
              <label>Apiary</label>
              <select
                value={editForm.apiary_id}
                onChange={(e) => setEditForm({ ...editForm, apiary_id: e.target.value })}
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
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value as any })}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="retired">Retired</option>
              </select>
            </div>
            {editError && (
              <div className="error-message">{editError}</div>
            )}
            {editSuccess && (
              <div className="success-message">Hive updated successfully!</div>
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

      {!isEditing && (
        <div className="hive-actions">
          <Link
            to={`/inspections/new/${hive.id}`}
            className="btn-primary btn-large"
          >
            <img src="/add-inspection-icon.png" alt="" className="btn-icon" />
            New Inspection
          </Link>
        </div>
      )}

      {!isEditing && id && (
        <section className="hive-section">
          <PhotoUpload
            entityType="hives"
            entityId={id}
            photos={photos}
            onPhotoUploaded={loadHive}
          />
        </section>
      )}

      <section className="hive-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3>Recent Inspections</h3>
          {inspections.length > 0 && (() => {
            const lastInspection = inspections[0];
            const lastInspectionDate = new Date(lastInspection.started_at);
            const daysSince = Math.floor((new Date().getTime() - lastInspectionDate.getTime()) / (1000 * 60 * 60 * 24));
            if (daysSince > 30) {
              return (
                <span style={{ color: '#c62828', fontWeight: '600', fontSize: '0.875rem' }}>
                  ⚠️ Last inspection {daysSince} days ago
                </span>
              );
            }
            return null;
          })()}
        </div>
        {inspections.length === 0 ? (
          <div>
            <p className="empty-state" style={{ color: '#c62828', fontWeight: '500' }}>
              ⚠️ No inspections yet - Start tracking your hive health!
            </p>
          </div>
        ) : (
          <div className="inspection-list">
            {inspections.map((inspection) => {
              // Parse weather_json if it's a string
              let weatherData: WeatherData | null = null;
              if (inspection.weather_json) {
                if (typeof inspection.weather_json === 'string') {
                  try {
                    weatherData = JSON.parse(inspection.weather_json);
                  } catch (e) {
                    console.error('Failed to parse weather_json:', e);
                  }
                } else {
                  weatherData = inspection.weather_json;
                }
              }
              
              return (
                <div 
                  key={inspection.id} 
                  className="inspection-card inspection-card-clickable"
                  onClick={() => handleInspectionClick(inspection.id)}
                >
                  <div className="inspection-header">
                    <div className="inspection-date">
                      <img src="/inspection-icon.png" alt="" className="icon-inline" />
                      {new Date(inspection.started_at).toLocaleString()}
                    </div>
                    {inspection.inspector_name && (
                      <div className="inspection-inspector">
                        By {inspection.inspector_name}
                      </div>
                    )}
                  </div>
                  {weatherData && (
                    <div className="inspection-weather" style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                      <WeatherDisplay weather={weatherData} compact={true} />
                    </div>
                  )}
                  {inspection.notes && (
                    <p className="inspection-notes">{parseNotes(inspection.notes) || ''}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {queens.length > 0 && (
        <section className="hive-section">
          <h3>Queen Records</h3>
          <div className="queen-list">
            {queens.map((queen) => (
              <div key={queen.id} className="queen-item">
                <div className="queen-name">{queen.name || 'Unnamed Queen'}</div>
                <div className="queen-meta">
                  Status: <span className={`queen-status status-${queen.status}`}>{queen.status}</span>
                  {queen.birth_date && (
                    <span>Born: {new Date(queen.birth_date).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {harvests.length > 0 && (
        <section className="hive-section">
          <h3>Honey Harvests</h3>
          <div className="harvest-list">
            {harvests.map((harvest) => (
              <div key={harvest.id} className="harvest-item">
                <div className="harvest-date">
                  {new Date(harvest.harvest_date).toLocaleDateString()}
                </div>
                <div className="harvest-weight">
                  {harvest.weight_kg} kg
                  {harvest.frames && ` (${harvest.frames} frames)`}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tasks.length > 0 && (
        <section className="hive-section">
          <h3>Tasks</h3>
          <div className="task-list">
            {tasks.map((task) => {
              const isInspectionDue = task.type === 'inspection_due';
              const today = new Date().toISOString().split('T')[0];
              const isOverdue = new Date(task.due_date) < new Date();
              const isDueToday = task.due_date === today;
              
              return (
                <div 
                  key={task.id} 
                  className="task-item"
                  style={{
                    borderLeft: isOverdue ? '4px solid #c62828' : isDueToday ? '4px solid #ff9800' : isInspectionDue ? '4px solid #2196f3' : undefined,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div className="task-title" style={{ fontWeight: isInspectionDue ? '600' : '500' }}>
                      {isInspectionDue && '🔍 '}
                      {task.title}
                    </div>
                    <div className="task-meta">
                      Due: {new Date(task.due_date).toLocaleDateString()}
                      {isOverdue && <span style={{ color: '#c62828', fontWeight: '500', marginLeft: '0.5rem' }}>(Overdue)</span>}
                      {isDueToday && !isOverdue && <span style={{ color: '#ff9800', fontWeight: '500', marginLeft: '0.5rem' }}>(Due Today)</span>}
                      <span className={`task-status task-${task.status}`} style={{ marginLeft: '0.5rem' }}>
                        {task.status}
                      </span>
                    </div>
                  </div>
                  {isInspectionDue && (isOverdue || isDueToday) && (
                    <Link
                      to={`/inspections/new/${id}`}
                      className="btn-primary"
                      style={{ marginLeft: '1rem', padding: '0.5rem 1rem', fontSize: '0.875rem', textDecoration: 'none' }}
                    >
                      Start Inspection
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="hive-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3>Maintenance</h3>
          <Link to="/maintenance" className="btn-link" style={{ fontSize: '0.875rem' }}>
            View All →
          </Link>
        </div>
        {(() => {
          // Filter to only show schedules that are overdue or due today
          const today = new Date().toISOString().split('T')[0];
          const upcomingSchedules = maintenanceSchedules.filter(schedule => {
            const dueDate = schedule.next_due_date;
            return dueDate <= today;
          });
          
          return upcomingSchedules.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--gray-600)' }}>Upcoming</h4>
              <div className="task-list">
                {upcomingSchedules.slice(0, 3).map((schedule) => {
                  const isOverdue = new Date(schedule.next_due_date) < new Date();
                  const isDueToday = schedule.next_due_date === today;
                return (
                  <div key={schedule.id} className="task-item" style={{ borderLeft: isOverdue ? '4px solid #c62828' : isDueToday ? '4px solid #ff9800' : undefined, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div className="task-title">{schedule.name}</div>
                      <div className="task-meta">
                        Due: {new Date(schedule.next_due_date).toLocaleDateString()}
                        {isOverdue && <span style={{ color: '#c62828', fontWeight: '500' }}> (Overdue)</span>}
                        {isDueToday && !isOverdue && <span style={{ color: '#ff9800', fontWeight: '500' }}> (Due Today)</span>}
                      </div>
                    </div>
                    {(isOverdue || isDueToday) && (
                      <button
                        onClick={() => handleCompleteMaintenance(schedule.id)}
                        className="btn-primary"
                        style={{ marginLeft: '1rem', padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                      >
                        Complete
                      </button>
                    )}
                  </div>
                );
                })}
              </div>
            </div>
          );
        })()}
        {maintenanceHistory.length > 0 && (
          <div>
            <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--gray-600)' }}>Recent History</h4>
            <div className="task-list">
              {maintenanceHistory.slice(0, 3).map((history) => (
                <div key={history.id} className="task-item">
                  <div className="task-title">{history.schedule_name || 'Maintenance'}</div>
                  <div className="task-meta">
                    Completed: {new Date(history.completed_date).toLocaleDateString()}
                    {history.completed_by_name && <span> by {history.completed_by_name}</span>}
                  </div>
                  {history.notes && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--gray-600)', marginTop: '0.25rem' }}>
                      {parseNotes(history.notes) || ''}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {maintenanceSchedules.length === 0 && maintenanceHistory.length === 0 && (
          <p className="empty-state">No maintenance records</p>
        )}
      </section>

      {/* Inspection Summary Modal */}
      {isModalOpen && selectedInspection && (
        <div className="inspection-modal-overlay" onClick={closeModal}>
          <div className="inspection-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="inspection-modal-close" onClick={closeModal} aria-label="Close">
              ×
            </button>
            {inspectionLoading ? (
              <div className="inspection-modal-loading">Loading inspection details...</div>
            ) : inspectionError ? (
              <div className="inspection-modal-error">{inspectionError}</div>
            ) : (
              <InspectionSummary inspection={selectedInspection} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Inspection Summary Component
function InspectionSummary({ inspection }: { inspection: FullInspection }) {
  const sections = parseSections(inspection.sections_json);
  const weatherData = typeof inspection.weather_json === 'string' 
    ? (() => {
        try {
          return JSON.parse(inspection.weather_json);
        } catch {
          return null;
        }
      })()
    : inspection.weather_json;

  const duration = formatDuration(inspection.started_at, inspection.ended_at);

  return (
    <div className="inspection-summary">
      <div className="inspection-summary-header">
        <div>
          <h2>Inspection Details</h2>
          <div className="inspection-summary-meta">
            <div>
              <strong>Date:</strong> {new Date(inspection.started_at).toLocaleString()}
            </div>
            {inspection.ended_at && duration && (
              <div>
                <strong>Duration:</strong> {duration}
              </div>
            )}
            {inspection.inspector_name && (
              <div>
                <strong>Inspector:</strong> {inspection.inspector_name}
              </div>
            )}
          </div>
        </div>
      </div>

      {weatherData && (
        <div className="inspection-summary-section">
          <h3>Weather</h3>
          <WeatherDisplay weather={weatherData} compact={false} showDetails={true} />
        </div>
      )}

      {sections?.queen && (
        <div className="inspection-summary-section">
          <h3>Queen</h3>
          <div className="inspection-section-details">
            {sections.queen.present !== undefined && (
              <div><strong>Present:</strong> {sections.queen.present ? 'Yes' : 'No'}</div>
            )}
            {sections.queen.marked !== undefined && (
              <div><strong>Marked:</strong> {sections.queen.marked ? 'Yes' : 'No'}</div>
            )}
            {sections.queen.clipped !== undefined && (
              <div><strong>Clipped:</strong> {sections.queen.clipped ? 'Yes' : 'No'}</div>
            )}
            {sections.queen.notes && (
              <div><strong>Notes:</strong> {sections.queen.notes}</div>
            )}
          </div>
        </div>
      )}

      {sections?.brood && (
        <div className="inspection-summary-section">
          <h3>Brood</h3>
          <div className="inspection-section-details">
            {sections.brood.frames !== undefined && (
              <div><strong>Frames:</strong> {sections.brood.frames}</div>
            )}
            {sections.brood.pattern && (
              <div><strong>Pattern:</strong> {capitalize(sections.brood.pattern)}</div>
            )}
            {sections.brood.notes && (
              <div><strong>Notes:</strong> {sections.brood.notes}</div>
            )}
          </div>
        </div>
      )}

      {sections?.strength && (
        <div className="inspection-summary-section">
          <h3>Strength</h3>
          <div className="inspection-section-details">
            {sections.strength.frames !== undefined && (
              <div><strong>Frames:</strong> {sections.strength.frames}</div>
            )}
            {sections.strength.population && (
              <div><strong>Population:</strong> {capitalize(sections.strength.population)}</div>
            )}
            {sections.strength.notes && (
              <div><strong>Notes:</strong> {sections.strength.notes}</div>
            )}
          </div>
        </div>
      )}

      {sections?.stores && (
        <div className="inspection-summary-section">
          <h3>Stores</h3>
          <div className="inspection-section-details">
            {sections.stores.honey && (
              <div><strong>Honey:</strong> {capitalize(sections.stores.honey)}</div>
            )}
            {sections.stores.pollen && (
              <div><strong>Pollen:</strong> {capitalize(sections.stores.pollen)}</div>
            )}
            {sections.stores.notes && (
              <div><strong>Notes:</strong> {sections.stores.notes}</div>
            )}
          </div>
        </div>
      )}

      {sections?.temperament && (
        <div className="inspection-summary-section">
          <h3>Temperament</h3>
          <div className="inspection-section-details">
            {sections.temperament.rating && (
              <div><strong>Rating:</strong> {capitalize(sections.temperament.rating)}</div>
            )}
            {sections.temperament.notes && (
              <div><strong>Notes:</strong> {sections.temperament.notes}</div>
            )}
          </div>
        </div>
      )}

      {sections?.health && (
        <div className="inspection-summary-section">
          <h3>Health</h3>
          <div className="inspection-section-details">
            {sections.health.pests && sections.health.pests.length > 0 && (
              <div>
                <strong>Pests:</strong> {sections.health.pests.join(', ')}
              </div>
            )}
            {sections.health.diseases && sections.health.diseases.length > 0 && (
              <div>
                <strong>Diseases:</strong> {sections.health.diseases.join(', ')}
              </div>
            )}
            {sections.health.notes && (
              <div><strong>Notes:</strong> {sections.health.notes}</div>
            )}
          </div>
        </div>
      )}

      {inspection.notes && (
        <div className="inspection-summary-section">
          <h3>General Notes</h3>
          <p>{parseNotes(inspection.notes) || ''}</p>
        </div>
      )}

      {inspection.photos && inspection.photos.length > 0 && (
        <div className="inspection-summary-section">
          <h3>Photos</h3>
          <div className="inspection-photos-grid">
            {inspection.photos.map((photo) => (
              <div key={photo.id} className="inspection-photo-item">
                <AuthenticatedImage
                  src={`/api/photos/${photo.id}/image`}
                  alt="Inspection photo"
                  className="inspection-photo"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {inspection.treatments && inspection.treatments.length > 0 && (
        <div className="inspection-summary-section">
          <h3>Treatments</h3>
          <div className="inspection-treatments-list">
            {inspection.treatments.map((treatment) => (
              <div key={treatment.id} className="inspection-treatment-item">
                <div><strong>{treatment.type}</strong> - {treatment.product}</div>
                {treatment.batch && <div>Batch: {treatment.batch}</div>}
                {treatment.dose && <div>Dose: {treatment.dose}</div>}
                {treatment.method && <div>Method: {treatment.method}</div>}
                {treatment.withdrawal_end_date && (
                  <div>Withdrawal End: {new Date(treatment.withdrawal_end_date).toLocaleDateString()}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!sections && !inspection.notes && (!inspection.photos || inspection.photos.length === 0) && 
       (!inspection.treatments || inspection.treatments.length === 0) && (
        <div className="inspection-summary-section">
          <p className="empty-state">No inspection details recorded</p>
        </div>
      )}
    </div>
  );
}
