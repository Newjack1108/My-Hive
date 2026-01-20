import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../utils/api';
import './HiveDetail.css';

interface Hive {
  id: string;
  public_id: string;
  label: string;
  status: string;
  apiary_name?: string;
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

export default function HiveDetail() {
  const { id } = useParams<{ id: string }>();
  const [hive, setHive] = useState<Hive | null>(null);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadHive();
    }
  }, [id]);

  const loadHive = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/hives/${id}`);
      setHive(res.data.hive);
      setInspections(res.data.inspections || []);
      setTasks(res.data.tasks || []);
    } catch (error) {
      console.error('Failed to load hive:', error);
    } finally {
      setLoading(false);
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
        <div className="hive-header-title">
          <img src="/hive-icon.png" alt="" className="hive-header-icon" />
          <h2>{hive.label}</h2>
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
      </div>

      <div className="hive-actions">
        <Link
          to={`/inspections/new/${hive.id}`}
          className="btn-primary btn-large"
        >
          <img src="/add-inspection-icon.png" alt="" className="btn-icon" />
          New Inspection
        </Link>
      </div>

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
    </div>
  );
}
