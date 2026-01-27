import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import './SeasonalEvents.css';

interface SeasonalEvent {
  id: string;
  template_id?: string;
  template_name?: string;
  name: string;
  event_type: 'nectar_flow' | 'bloom_period' | 'swarm_season' | 'winter_prep' | 'spring_buildup' | 'dearth_period' | 'harvest_season' | 'other';
  description?: string;
  start_date: string;
  end_date?: string;
  recurring: boolean;
  recurring_start_month?: number;
  recurring_start_day?: number;
  recurring_duration_days?: number;
  apiary_id?: string;
  apiary_name?: string;
  notes?: string;
  color: string;
  created_by_name?: string;
  created_at: string;
}

interface SeasonalEventTemplate {
  id: string;
  name: string;
  event_type: string;
  description?: string;
  default_start_month?: number;
  default_start_day?: number;
  default_end_month?: number;
  default_end_day?: number;
  default_duration_days?: number;
  region?: string;
  color: string;
}

interface Apiary {
  id: string;
  name: string;
}

export default function SeasonalEvents() {
  const { user } = useAuth();
  const [events, setEvents] = useState<SeasonalEvent[]>([]);
  const [templates, setTemplates] = useState<SeasonalEventTemplate[]>([]);
  const [apiaries, setApiaries] = useState<Apiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<SeasonalEvent | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<SeasonalEventTemplate | null>(null);
  const [formData, setFormData] = useState({
    template_id: '',
    name: '',
    event_type: 'nectar_flow' as SeasonalEvent['event_type'],
    description: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    recurring: false,
    recurring_start_month: 1,
    recurring_start_day: 1,
    recurring_duration_days: 30,
    apiary_id: '',
    notes: '',
    color: '#10b981'
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [filterType, setFilterType] = useState<string>('');

  useEffect(() => {
    loadData();
  }, [filterYear, filterType]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filterYear) params.year = filterYear;
      if (filterType) params.event_type = filterType;

      const [eventsRes, templatesRes, apiariesRes] = await Promise.all([
        api.get('/seasonal-events', { params }),
        api.get('/seasonal-events/templates'),
        api.get('/apiaries')
      ]);
      setEvents(eventsRes.data.events || []);
      setTemplates(templatesRes.data.templates || []);
      setApiaries(apiariesRes.data.apiaries || []);
    } catch (error: any) {
      console.error('Failed to load data:', error);
      setError(error.response?.data?.error || 'Failed to load seasonal events');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFromTemplate = async (template: SeasonalEventTemplate) => {
    try {
      setError(null);
      setSuccess(false);
      await api.post(`/seasonal-events/from-template/${template.id}`);
      setSuccess(true);
      setShowTemplateSelector(false);
      setSelectedTemplate(null);
      setTimeout(() => {
        loadData();
      }, 1000);
    } catch (error: any) {
      console.error('Failed to create from template:', error);
      setError(error.response?.data?.error || 'Failed to create event from template');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      setSuccess(false);

      const submitData: any = {
        name: formData.name,
        event_type: formData.event_type,
        start_date: formData.start_date,
        recurring: formData.recurring,
        color: formData.color
      };

      if (formData.template_id) {
        submitData.template_id = formData.template_id;
      }
      if (formData.description) {
        submitData.description = formData.description;
      }
      if (formData.end_date) {
        submitData.end_date = formData.end_date;
      }
      if (formData.recurring) {
        submitData.recurring_start_month = formData.recurring_start_month;
        submitData.recurring_start_day = formData.recurring_start_day;
        submitData.recurring_duration_days = formData.recurring_duration_days;
      }
      if (formData.apiary_id) {
        submitData.apiary_id = formData.apiary_id;
      }
      if (formData.notes) {
        submitData.notes = formData.notes;
      }

      if (selectedEvent) {
        await api.patch(`/seasonal-events/${selectedEvent.id}`, submitData);
      } else {
        await api.post('/seasonal-events', submitData);
      }

      setSuccess(true);
      setTimeout(() => {
        setShowForm(false);
        setSelectedEvent(null);
        setFormData({
          template_id: '',
          name: '',
          event_type: 'nectar_flow',
          description: '',
          start_date: new Date().toISOString().split('T')[0],
          end_date: '',
          recurring: false,
          recurring_start_month: 1,
          recurring_start_day: 1,
          recurring_duration_days: 30,
          apiary_id: '',
          notes: '',
          color: '#10b981'
        });
        loadData();
      }, 1000);
    } catch (error: any) {
      console.error('Failed to save event:', error);
      setError(error.response?.data?.error || 'Failed to save event');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this seasonal event?')) return;
    try {
      await api.delete(`/seasonal-events/${id}`);
      loadData();
    } catch (error: any) {
      console.error('Failed to delete event:', error);
      alert(error.response?.data?.error || 'Failed to delete event');
    }
  };

  const handleEdit = (event: SeasonalEvent) => {
    setSelectedEvent(event);
    setFormData({
      template_id: event.template_id || '',
      name: event.name,
      event_type: event.event_type,
      description: event.description || '',
      start_date: event.start_date,
      end_date: event.end_date || '',
      recurring: event.recurring,
      recurring_start_month: event.recurring_start_month || 1,
      recurring_start_day: event.recurring_start_day || 1,
      recurring_duration_days: event.recurring_duration_days || 30,
      apiary_id: event.apiary_id || '',
      notes: event.notes || '',
      color: event.color
    });
    setShowForm(true);
  };

  const handleTemplateSelect = (template: SeasonalEventTemplate) => {
    setSelectedTemplate(template);
    const currentYear = new Date().getFullYear();
    let startDate = new Date();
    let endDate: Date | null = null;

    if (template.default_start_month && template.default_start_day) {
      startDate = new Date(currentYear, template.default_start_month - 1, template.default_start_day);
    }

    if (template.default_end_month && template.default_end_day) {
      endDate = new Date(currentYear, template.default_end_month - 1, template.default_end_day);
    } else if (template.default_duration_days) {
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + template.default_duration_days);
    }

    setFormData({
      template_id: template.id,
      name: template.name,
      event_type: template.event_type as SeasonalEvent['event_type'],
      description: template.description || '',
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate ? endDate.toISOString().split('T')[0] : '',
      recurring: true,
      recurring_start_month: template.default_start_month || 1,
      recurring_start_day: template.default_start_day || 1,
      recurring_duration_days: template.default_duration_days || (endDate && startDate ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) : 30),
      apiary_id: '',
      notes: '',
      color: template.color
    });
    setShowTemplateSelector(false);
    setShowForm(true);
  };

  const getEventTypeLabel = (type: string): string => {
    return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getEventTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      nectar_flow: '#10b981',
      bloom_period: '#8b5cf6',
      swarm_season: '#f59e0b',
      winter_prep: '#3b82f6',
      spring_buildup: '#8b5cf6',
      dearth_period: '#ef4444',
      harvest_season: '#eab308',
      other: '#6b7280'
    };
    return colors[type] || '#6b7280';
  };

  if (loading) {
    return <div className="seasonal-events-loading">Loading...</div>;
  }

  return (
    <div className="seasonal-events">
      <div className="page-header">
        <img src="/calendar-icon.png" alt="" className="page-icon" />
        <h2>Seasonal Events & Nectar Flows</h2>
        <div className="page-actions">
          {(user?.role === 'admin' || user?.role === 'manager' || user?.role === 'inspector') && (
            <>
              <button onClick={() => setShowTemplateSelector(true)} className="btn-primary">
                + From Template
              </button>
              <button onClick={() => {
                setSelectedEvent(null);
                setFormData({
                  template_id: '',
                  name: '',
                  event_type: 'nectar_flow',
                  description: '',
                  start_date: new Date().toISOString().split('T')[0],
                  end_date: '',
                  recurring: false,
                  recurring_start_month: 1,
                  recurring_start_day: 1,
                  recurring_duration_days: 30,
                  apiary_id: '',
                  notes: '',
                  color: '#10b981'
                });
                setShowForm(true);
              }} className="btn-primary">
                + Custom Event
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="error-message">{error}</div>
      )}

      {showTemplateSelector && (
        <div className="template-selector-modal" onClick={() => setShowTemplateSelector(false)}>
          <div className="template-selector-content" onClick={(e) => e.stopPropagation()}>
            <h3>Select Template</h3>
            <div className="templates-grid">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="template-card"
                  onClick={() => handleTemplateSelect(template)}
                  style={{ borderLeftColor: template.color }}
                >
                  <div className="template-name">{template.name}</div>
                  <div className="template-type">{getEventTypeLabel(template.event_type)}</div>
                  {template.description && (
                    <div className="template-description">{template.description}</div>
                  )}
                  {template.region && (
                    <div className="template-region">{template.region}</div>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setShowTemplateSelector(false)} className="btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="create-form-container">
          <div className="seasonal-event-form">
            <h3>{selectedEvent ? 'Edit' : 'Create'} Seasonal Event</h3>
            <form onSubmit={handleSubmit}>
              {selectedTemplate && (
                <div className="form-group">
                  <label>Template</label>
                  <input type="text" value={selectedTemplate.name} disabled />
                </div>
              )}

              <div className="form-group">
                <label>Event Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  maxLength={255}
                />
              </div>

              <div className="form-group">
                <label>Event Type *</label>
                <select
                  value={formData.event_type}
                  onChange={(e) => {
                    setFormData({ ...formData, event_type: e.target.value as SeasonalEvent['event_type'], color: getEventTypeColor(e.target.value) });
                  }}
                  required
                >
                  <option value="nectar_flow">Nectar Flow</option>
                  <option value="bloom_period">Bloom Period</option>
                  <option value="swarm_season">Swarm Season</option>
                  <option value="winter_prep">Winter Preparation</option>
                  <option value="spring_buildup">Spring Buildup</option>
                  <option value="dearth_period">Dearth Period</option>
                  <option value="harvest_season">Harvest Season</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Start Date *</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>End Date</label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    min={formData.start_date}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.recurring}
                    onChange={(e) => setFormData({ ...formData, recurring: e.target.checked })}
                  />
                  Recurring Annually
                </label>
              </div>

              {formData.recurring && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Recurring Start Month</label>
                      <select
                        value={formData.recurring_start_month}
                        onChange={(e) => setFormData({ ...formData, recurring_start_month: parseInt(e.target.value) })}
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                          <option key={month} value={month}>
                            {new Date(2000, month - 1).toLocaleString('default', { month: 'long' })}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Recurring Start Day</label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={formData.recurring_start_day}
                        onChange={(e) => setFormData({ ...formData, recurring_start_day: parseInt(e.target.value) })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Duration (days)</label>
                      <input
                        type="number"
                        min="1"
                        value={formData.recurring_duration_days}
                        onChange={(e) => setFormData({ ...formData, recurring_duration_days: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="form-group">
                <label>Apiary (Optional)</label>
                <select
                  value={formData.apiary_id}
                  onChange={(e) => setFormData({ ...formData, apiary_id: e.target.value })}
                >
                  <option value="">All Apiaries</option>
                  {apiaries.map((apiary) => (
                    <option key={apiary.id} value={apiary.id}>
                      {apiary.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Color</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    style={{ width: '60px', height: '40px', cursor: 'pointer' }}
                  />
                  <input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    pattern="^#[0-9A-Fa-f]{6}$"
                    style={{ flex: 1 }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>

              {error && (
                <div className="error-message">{error}</div>
              )}
              {success && (
                <div className="success-message">Event {selectedEvent ? 'updated' : 'created'} successfully!</div>
              )}

              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  {selectedEvent ? 'Update' : 'Create'} Event
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setSelectedEvent(null);
                    setSelectedTemplate(null);
                    setFormData({
                      template_id: '',
                      name: '',
                      event_type: 'nectar_flow',
                      description: '',
                      start_date: new Date().toISOString().split('T')[0],
                      end_date: '',
                      recurring: false,
                      recurring_start_month: 1,
                      recurring_start_day: 1,
                      recurring_duration_days: 30,
                      apiary_id: '',
                      notes: '',
                      color: '#10b981'
                    });
                    setError(null);
                    setSuccess(false);
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="seasonal-events-filters">
        <label>
          Year:
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
              <option key={year} value={year.toString()}>{year}</option>
            ))}
          </select>
        </label>
        <label>
          Event Type:
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">All Types</option>
            <option value="nectar_flow">Nectar Flow</option>
            <option value="bloom_period">Bloom Period</option>
            <option value="swarm_season">Swarm Season</option>
            <option value="winter_prep">Winter Prep</option>
            <option value="spring_buildup">Spring Buildup</option>
            <option value="dearth_period">Dearth Period</option>
            <option value="harvest_season">Harvest Season</option>
            <option value="other">Other</option>
          </select>
        </label>
      </div>

      {events.length === 0 ? (
        <p className="empty-state">No seasonal events recorded yet. Create one from a template or create a custom event.</p>
      ) : (
        <div className="seasonal-events-list">
          {events.map((event) => {
            const isPast = event.end_date ? new Date(event.end_date) < new Date() : new Date(event.start_date) < new Date();
            const isCurrent = new Date(event.start_date) <= new Date() && (!event.end_date || new Date(event.end_date) >= new Date());
            
            return (
              <div key={event.id} className="seasonal-event-card" style={{ borderLeftColor: event.color }}>
                <div className="seasonal-event-header">
                  <h3>{event.name}</h3>
                  <div className="seasonal-event-actions">
                    {(user?.role === 'admin' || user?.role === 'manager' || user?.role === 'inspector') && (
                      <>
                        <button onClick={() => handleEdit(event)} className="btn-secondary">
                          Edit
                        </button>
                        {(user?.role === 'admin' || user?.role === 'manager') && (
                          <button onClick={() => handleDelete(event.id)} className="btn-danger">
                            Delete
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <div className="seasonal-event-info">
                  <div className="seasonal-event-badge" style={{ backgroundColor: event.color + '20', color: event.color }}>
                    {getEventTypeLabel(event.event_type)}
                  </div>
                  <p><strong>Dates:</strong> {new Date(event.start_date).toLocaleDateString()} 
                    {event.end_date && ` - ${new Date(event.end_date).toLocaleDateString()}`}
                  </p>
                  {event.recurring && (
                    <p><strong>Recurring:</strong> Yes (annually)</p>
                  )}
                  {event.apiary_name && (
                    <p><strong>Apiary:</strong> {event.apiary_name}</p>
                  )}
                  {event.description && (
                    <p><strong>Description:</strong> {event.description}</p>
                  )}
                  {event.notes && (
                    <p><strong>Notes:</strong> {event.notes}</p>
                  )}
                  {isCurrent && (
                    <span className="status-badge status-current">Current</span>
                  )}
                  {isPast && !isCurrent && (
                    <span className="status-badge status-past">Past</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
