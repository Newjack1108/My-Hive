import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
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

export default function HiveDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [hive, setHive] = useState<Hive | null>(null);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [harvests, setHarvests] = useState<HoneyHarvest[]>([]);
  const [queens, setQueens] = useState<Queen[]>([]);
  const [apiaries, setApiaries] = useState<Apiary[]>([]);
  const [maintenanceSchedules, setMaintenanceSchedules] = useState<MaintenanceSchedule[]>([]);
  const [maintenanceHistory, setMaintenanceHistory] = useState<MaintenanceHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    label: '',
    apiary_id: '',
    status: 'active' as 'active' | 'inactive' | 'retired'
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState(false);

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

      <section className="hive-section">
        <h3>Recent Inspections</h3>
        {inspections.length === 0 ? (
          <p className="empty-state">No inspections yet</p>
        ) : (
          <div className="inspection-list">
            {inspections.map((inspection) => (
              <div key={inspection.id} className="inspection-card">
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
                {inspection.notes && (
                  <p className="inspection-notes">{inspection.notes}</p>
                )}
              </div>
            ))}
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
            {tasks.map((task) => (
              <div key={task.id} className="task-item">
                <div className="task-title">{task.title}</div>
                <div className="task-meta">
                  Due: {new Date(task.due_date).toLocaleDateString()}
                  <span className={`task-status task-${task.status}`}>
                    {task.status}
                  </span>
                </div>
              </div>
            ))}
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
        {maintenanceSchedules.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--gray-600)' }}>Upcoming</h4>
            <div className="task-list">
              {maintenanceSchedules.slice(0, 3).map((schedule) => {
                const isOverdue = new Date(schedule.next_due_date) < new Date();
                const isDueToday = schedule.next_due_date === new Date().toISOString().split('T')[0];
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
        )}
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
                      {history.notes}
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
    </div>
  );
}
