import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';
import { isOnline } from '../utils/offlineDb';
import NFCScanner from '../components/NFCScanner';
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
  type?: string;
  hive_label?: string;
  hive_id?: string;
}

interface UpcomingMaintenance {
  id: string;
  name: string;
  next_due_date: string;
  hive_label?: string;
}

export default function Dashboard() {
  const [apiaries, setApiaries] = useState<Apiary[]>([]);
  const [recentHives, setRecentHives] = useState<Hive[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [upcomingMaintenance, setUpcomingMaintenance] = useState<UpcomingMaintenance[]>([]);
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
      const [apiariesRes, hivesRes, tasksRes, maintenanceRes, allTasksRes] = await Promise.all([
        api.get('/apiaries'),
        api.get('/hives?limit=10'),
        api.get('/tasks?assigned_to_me=true&status=pending'),
        api.get('/maintenance/upcoming?days=7').catch(() => ({ data: { upcoming: [] } })),
        api.get('/tasks?status=pending').catch(() => ({ data: { tasks: [] } })),
      ]);

      setApiaries(apiariesRes.data.apiaries);
      setRecentHives(hivesRes.data.hives);
      setTasks(tasksRes.data.tasks);
      setUpcomingMaintenance(maintenanceRes.data.upcoming || []);
      
      // Filter inspection_due tasks from all tasks
      const inspectionDueTasks = (allTasksRes.data.tasks || []).filter(
        (task: Task) => task.type === 'inspection_due'
      );
      setTasks((prev) => [...prev, ...inspectionDueTasks.filter(
        (t: Task) => !prev.some(p => p.id === t.id)
      )]);
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
        <div className="dashboard-header-actions">
          <NFCScanner />
          <div className={`sync-status ${online ? 'online' : 'offline'}`}>
            {online ? '🟢 Online' : '🔴 Offline'}
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <section className="dashboard-card">
          <div className="dashboard-card-header">
            <img src="/apiary-icon.png" alt="" className="dashboard-icon" />
            <h3>Apiaries</h3>
          </div>
          <div className="stat-value">{apiaries.length}</div>
          <Link to="/apiaries" className="btn-link">
            View All →
          </Link>
        </section>

        <section className="dashboard-card">
          <div className="dashboard-card-header">
            <img src="/hive-icon.png" alt="" className="dashboard-icon" />
            <h3>Hives</h3>
          </div>
          <div className="stat-value">{recentHives.length}</div>
          <Link to="/apiaries" className="btn-link">
            Manage Hives →
          </Link>
        </section>

        <section className="dashboard-card">
          <div className="dashboard-card-header">
            <img src="/inspection-icon.png" alt="" className="dashboard-icon" />
            <h3>Pending Tasks</h3>
          </div>
          <div className="stat-value">{tasks.length}</div>
        </section>

        <section className="dashboard-card">
          <div className="dashboard-card-header">
            <img src="/resources-icon.png" alt="" className="dashboard-icon" />
            <h3>Upcoming Maintenance</h3>
          </div>
          <div className="stat-value">{upcomingMaintenance.length}</div>
          <Link to="/maintenance" className="btn-link">
            View All →
          </Link>
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
              <div className="hive-card-header">
                <img src="/hive-icon.png" alt="" className="hive-icon-small" />
                <div className="hive-label">{hive.label}</div>
              </div>
              <div className="hive-meta">
                {hive.apiary_name && (
                  <span>
                    <img src="/map-icon.png" alt="" className="icon-inline" />
                    {hive.apiary_name}
                  </span>
                )}
                {hive.last_inspection_at && (
                  <span>
                    <img src="/inspection-icon.png" alt="" className="icon-inline" />
                    Last inspection: {new Date(hive.last_inspection_at).toLocaleDateString()}
                    {(() => {
                      const daysSince = Math.floor((new Date().getTime() - new Date(hive.last_inspection_at).getTime()) / (1000 * 60 * 60 * 24));
                      if (daysSince > 30) {
                        return <span style={{ color: '#c62828', marginLeft: '0.5rem', fontWeight: '500' }}>({daysSince} days ago)</span>;
                      }
                      return null;
                    })()}
                  </span>
                )}
                {!hive.last_inspection_at && (
                  <span style={{ color: '#c62828', fontWeight: '500' }}>
                    <img src="/inspection-icon.png" alt="" className="icon-inline" />
                    No inspections yet
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {(() => {
        const inspectionDueTasks = tasks.filter(t => t.type === 'inspection_due');
        const otherTasks = tasks.filter(t => t.type !== 'inspection_due');
        const today = new Date().toISOString().split('T')[0];
        
        return (
          <>
            {inspectionDueTasks.length > 0 && (
              <section className="dashboard-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0, color: '#c62828' }}>⚠️ Inspections Due</h3>
                  <Link to="/maintenance" className="btn-link" style={{ fontSize: '0.875rem' }}>
                    Schedule →
                  </Link>
                </div>
                <div className="task-list">
                  {inspectionDueTasks.slice(0, 5).map((task) => {
                    const isOverdue = new Date(task.due_date) < new Date();
                    const isDueToday = task.due_date === today;
                    return (
                      <Link
                        key={task.id}
                        to={task.hive_id ? `/hives/${task.hive_id}/inspect` : '/maintenance'}
                        className="task-item"
                        style={{
                          textDecoration: 'none',
                          color: 'inherit',
                          borderLeft: isOverdue ? '4px solid #c62828' : isDueToday ? '4px solid #ff9800' : '4px solid #2196f3',
                          display: 'block'
                        }}
                      >
                        <div className="task-title" style={{ fontWeight: isOverdue ? '600' : '500' }}>
                          {task.title}
                        </div>
                        <div className="task-meta">
                          {task.hive_label && <span>Hive: {task.hive_label}</span>}
                          <span>
                            Due: {new Date(task.due_date).toLocaleDateString()}
                            {isOverdue && <span style={{ color: '#c62828', fontWeight: '600', marginLeft: '0.5rem' }}>(Overdue)</span>}
                            {isDueToday && !isOverdue && <span style={{ color: '#ff9800', fontWeight: '600', marginLeft: '0.5rem' }}>(Due Today)</span>}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}
            {otherTasks.length > 0 && (
              <section className="dashboard-section">
                <h3>Other Tasks Due Soon</h3>
                <div className="task-list">
                  {otherTasks.slice(0, 5).map((task) => (
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
          </>
        );
      })()}

      {upcomingMaintenance.length > 0 && (
        <section className="dashboard-section">
          <h3>Maintenance Due Soon</h3>
          <div className="task-list">
            {upcomingMaintenance.slice(0, 5).map((maintenance) => (
              <Link
                key={maintenance.id}
                to="/maintenance"
                className="task-item"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div className="task-title">{maintenance.name}</div>
                <div className="task-meta">
                  {maintenance.hive_label && <span>Hive: {maintenance.hive_label}</span>}
                  <span>Due: {new Date(maintenance.next_due_date).toLocaleDateString()}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
