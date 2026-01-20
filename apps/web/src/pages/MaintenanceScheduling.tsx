import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import './MaintenanceScheduling.css';

interface Template {
  id: string;
  name: string;
  description?: string;
  task_type: string;
  default_duration_days?: number;
}

interface Schedule {
  id: string;
  name: string;
  frequency_type: string;
  frequency_value: number;
  next_due_date: string;
  is_active: boolean;
  template_name?: string;
  hive_label?: string;
}

export default function MaintenanceScheduling() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [upcoming, setUpcoming] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'templates' | 'schedules' | 'upcoming'>('upcoming');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [templatesRes, schedulesRes, upcomingRes] = await Promise.all([
        api.get('/maintenance/templates'),
        api.get('/maintenance/schedules'),
        api.get('/maintenance/upcoming')
      ]);
      setTemplates(templatesRes.data.templates);
      setSchedules(schedulesRes.data.schedules);
      setUpcoming(upcomingRes.data.upcoming);
    } catch (error) {
      console.error('Failed to load maintenance data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="maintenance-loading">Loading...</div>;
  }

  return (
    <div className="maintenance-scheduling">
      <h2>Maintenance Scheduling</h2>

      <div className="tabs">
        <button
          className={activeTab === 'upcoming' ? 'active' : ''}
          onClick={() => setActiveTab('upcoming')}
        >
          Upcoming ({upcoming.length})
        </button>
        <button
          className={activeTab === 'schedules' ? 'active' : ''}
          onClick={() => setActiveTab('schedules')}
        >
          Schedules ({schedules.length})
        </button>
        <button
          className={activeTab === 'templates' ? 'active' : ''}
          onClick={() => setActiveTab('templates')}
        >
          Templates ({templates.length})
        </button>
      </div>

      {activeTab === 'upcoming' && (
        <div className="upcoming-maintenance">
          <h3>Upcoming Maintenance</h3>
          {upcoming.length === 0 ? (
            <p>No upcoming maintenance tasks</p>
          ) : (
            <ul>
              {upcoming.map((schedule) => (
                <li key={schedule.id} className="schedule-item">
                  <div className="schedule-info">
                    <h4>{schedule.name}</h4>
                    {schedule.hive_label && <p>Hive: {schedule.hive_label}</p>}
                    <p>Due: {new Date(schedule.next_due_date).toLocaleDateString()}</p>
                    <p>Frequency: {schedule.frequency_value} {schedule.frequency_type}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {activeTab === 'schedules' && (
        <div className="schedules-list">
          <h3>Maintenance Schedules</h3>
          {schedules.length === 0 ? (
            <p>No schedules found</p>
          ) : (
            <ul>
              {schedules.map((schedule) => (
                <li key={schedule.id} className="schedule-item">
                  <div className="schedule-info">
                    <h4>{schedule.name}</h4>
                    {schedule.template_name && <p>Template: {schedule.template_name}</p>}
                    {schedule.hive_label && <p>Hive: {schedule.hive_label}</p>}
                    <p>Next Due: {new Date(schedule.next_due_date).toLocaleDateString()}</p>
                    <p>Frequency: {schedule.frequency_value} {schedule.frequency_type}</p>
                    <span className={`status ${schedule.is_active ? 'active' : 'inactive'}`}>
                      {schedule.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {activeTab === 'templates' && (
        <div className="templates-list">
          <h3>Maintenance Templates</h3>
          {templates.length === 0 ? (
            <p>No templates found</p>
          ) : (
            <ul>
              {templates.map((template) => (
                <li key={template.id} className="template-item">
                  <div className="template-info">
                    <h4>{template.name}</h4>
                    {template.description && <p>{template.description}</p>}
                    <p>Type: {template.task_type}</p>
                    {template.default_duration_days && (
                      <p>Duration: {template.default_duration_days} days</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
