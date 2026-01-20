import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';
import { isOnline } from '../utils/offlineDb';
import './Dashboard.css';

interface Apiary {
  id: string;
  name: string;
  hive_count?: number;
}

interface Hive {
  id: string;
  public_id: string;
  label: string;
  apiary_name?: string;
  last_inspection_at?: string;
}

interface Task {
  id: string;
  title: string;
  due_date: string;
  status: string;
  hive_label?: string;
}

export default function Dashboard() {
  const [apiaries, setApiaries] = useState<Apiary[]>([]);
  const [recentHives, setRecentHives] = useState<Hive[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(isOnline());

  useEffect(() => {
    const updateOnlineStatus = () => setOnline(isOnline());
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    loadData();

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [apiariesRes, hivesRes, tasksRes] = await Promise.all([
        api.get('/apiaries'),
        api.get('/hives?limit=10'),
        api.get('/tasks?assigned_to_me=true&status=pending'),
      ]);

      setApiaries(apiariesRes.data.apiaries);
      setRecentHives(hivesRes.data.hives);
      setTasks(tasksRes.data.tasks);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="dashboard-loading">Loading...</div>;
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>Dashboard</h2>
        <div className={`sync-status ${online ? 'online' : 'offline'}`}>
          {online ? '🟢 Online' : '🔴 Offline'}
        </div>
      </div>

      <div className="dashboard-grid">
        <section className="dashboard-card">
          <h3>Apiaries</h3>
          <div className="stat-value">{apiaries.length}</div>
          <Link to="/apiaries" className="btn-link">
            View All →
          </Link>
        </section>

        <section className="dashboard-card">
          <h3>Hives</h3>
          <div className="stat-value">{recentHives.length}</div>
          <Link to="/apiaries" className="btn-link">
            Manage Hives →
          </Link>
        </section>

        <section className="dashboard-card">
          <h3>Pending Tasks</h3>
          <div className="stat-value">{tasks.length}</div>
        </section>
      </div>

      <section className="dashboard-section">
        <h3>Recent Hives</h3>
        <div className="hive-list">
          {recentHives.map((hive) => (
            <Link
              key={hive.id}
              to={`/hives/${hive.id}`}
              className="hive-card"
            >
              <div className="hive-label">{hive.label}</div>
              <div className="hive-meta">
                {hive.apiary_name && <span>📍 {hive.apiary_name}</span>}
                {hive.last_inspection_at && (
                  <span>Last inspection: {new Date(hive.last_inspection_at).toLocaleDateString()}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {tasks.length > 0 && (
        <section className="dashboard-section">
          <h3>Tasks Due Soon</h3>
          <div className="task-list">
            {tasks.slice(0, 5).map((task) => (
              <div key={task.id} className="task-item">
                <div className="task-title">{task.title}</div>
                <div className="task-meta">
                  {task.hive_label && <span>Hive: {task.hive_label}</span>}
                  <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
