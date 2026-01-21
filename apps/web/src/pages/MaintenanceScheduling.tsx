import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import './MaintenanceScheduling.css';

interface Template {
  id: string;
  name: string;
  description?: string;
  task_type: string;
  default_duration_days?: number;
  instructions?: string;
  checklist_items?: string[];
}

interface Schedule {
  id: string;
  name: string;
  frequency_type: string;
  frequency_value: number;
  next_due_date: string;
  is_active: boolean;
  template_id?: string;
  template_name?: string;
  hive_id?: string;
  hive_label?: string;
}

interface Hive {
  id: string;
  label: string;
  public_id: string;
}

export default function MaintenanceScheduling() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [upcoming, setUpcoming] = useState<Schedule[]>([]);
  const [hives, setHives] = useState<Hive[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'templates' | 'schedules' | 'upcoming' | 'stats'>('upcoming');

  // Template form state
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    description: '',
    task_type: 'maintenance',
    default_duration_days: '',
    instructions: '',
    checklist_items: [] as string[]
  });
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [templateSuccess, setTemplateSuccess] = useState(false);

  // Schedule form state
  const [showCreateSchedule, setShowCreateSchedule] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<string | null>(null);
  const [scheduleForm, setScheduleForm] = useState({
    name: '',
    template_id: '',
    hive_id: '',
    frequency_type: 'monthly' as 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom',
    frequency_value: '1',
    next_due_date: '',
    is_active: true
  });
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleSuccess, setScheduleSuccess] = useState(false);
  const [schedulesCreatedCount, setSchedulesCreatedCount] = useState<number>(0);
  const [deletingSchedule, setDeletingSchedule] = useState<string | null>(null);

  // Complete maintenance state
  const [completingSchedule, setCompletingSchedule] = useState<string | null>(null);
  const [completionForm, setCompletionForm] = useState({
    completed_date: new Date().toISOString().split('T')[0],
    notes: '',
    checklist_completed: [] as boolean[]
  });
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [completionSuccess, setCompletionSuccess] = useState(false);

  // Bulk create state
  const [showBulkCreate, setShowBulkCreate] = useState(false);
  const [bulkForm, setBulkForm] = useState({
    template_id: '',
    frequency_type: 'monthly' as 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom',
    frequency_value: '1',
    next_due_date: '',
    all_hives: false,
    selected_hive_ids: [] as string[],
    selected_apiary_id: '',
    apiary_hive_ids: [] as string[]
  });
  const [apiaries, setApiaries] = useState<Array<{ id: string; name: string }>>([]);

  // Stats state
  const [stats, setStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [templatesRes, schedulesRes, upcomingRes, hivesRes, apiariesRes] = await Promise.all([
        api.get('/maintenance/templates'),
        api.get('/maintenance/schedules'),
        api.get('/maintenance/upcoming'),
        api.get('/hives'),
        api.get('/apiaries')
      ]);
      setTemplates(templatesRes.data.templates);
      setSchedules(schedulesRes.data.schedules);
      setUpcoming(upcomingRes.data.upcoming);
      setHives(hivesRes.data.hives || []);
      setApiaries(apiariesRes.data.apiaries || []);
    } catch (error) {
      console.error('Failed to load maintenance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      setStatsLoading(true);
      const res = await api.get('/maintenance/stats');
      setStats(res.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'stats') {
      loadStats();
    }
  }, [activeTab]);

  // Template handlers
  const startCreateTemplate = () => {
    setEditingTemplate(null);
    setTemplateForm({
      name: '',
      description: '',
      task_type: 'maintenance',
      default_duration_days: '',
      instructions: '',
      checklist_items: []
    });
    setTemplateError(null);
    setTemplateSuccess(false);
    setShowCreateTemplate(true);
  };

  const startEditTemplate = (template: Template) => {
    setEditingTemplate(template.id);
    setTemplateForm({
      name: template.name,
      description: template.description || '',
      task_type: template.task_type,
      default_duration_days: template.default_duration_days?.toString() || '',
      instructions: template.instructions || '',
      checklist_items: template.checklist_items || []
    });
    setTemplateError(null);
    setTemplateSuccess(false);
    setShowCreateTemplate(true);
  };

  const handleCreateTemplate = async () => {
    try {
      setTemplateError(null);
      setTemplateSuccess(false);

      const data: any = {
        name: templateForm.name,
        task_type: templateForm.task_type,
        description: templateForm.description || undefined,
        instructions: templateForm.instructions || undefined,
        checklist_items: templateForm.checklist_items.length > 0 ? templateForm.checklist_items : undefined
      };

      if (templateForm.default_duration_days) {
        data.default_duration_days = parseInt(templateForm.default_duration_days);
      }

      if (editingTemplate) {
        await api.patch(`/maintenance/templates/${editingTemplate}`, data);
      } else {
        await api.post('/maintenance/templates', data);
      }

      setTemplateSuccess(true);
      setTimeout(() => {
        setShowCreateTemplate(false);
        loadData();
      }, 1000);
    } catch (error: any) {
      console.error('Failed to save template:', error);
      setTemplateError(error.response?.data?.error || 'Failed to save template');
    }
  };

  const addChecklistItem = () => {
    setTemplateForm({
      ...templateForm,
      checklist_items: [...templateForm.checklist_items, '']
    });
  };

  const updateChecklistItem = (index: number, value: string) => {
    const newItems = [...templateForm.checklist_items];
    newItems[index] = value;
    setTemplateForm({ ...templateForm, checklist_items: newItems });
  };

  const removeChecklistItem = (index: number) => {
    const newItems = templateForm.checklist_items.filter((_, i) => i !== index);
    setTemplateForm({ ...templateForm, checklist_items: newItems });
  };

  const handleDeleteTemplate = async (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    const confirmMessage = `Are you sure you want to delete the template "${template.name}"? This action cannot be undone.`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      setDeletingTemplate(templateId);
      await api.delete(`/maintenance/templates/${templateId}`);
      loadData();
    } catch (error: any) {
      console.error('Failed to delete template:', error);
      alert(error.response?.data?.error || 'Failed to delete template');
    } finally {
      setDeletingTemplate(null);
    }
  };

  // Schedule handlers
  const startCreateSchedule = () => {
    setEditingSchedule(null);
    setScheduleForm({
      name: '',
      template_id: '',
      hive_id: '',
      frequency_type: 'monthly',
      frequency_value: '1',
      next_due_date: '',
      is_active: true
    });
    setScheduleError(null);
    setScheduleSuccess(false);
    setShowCreateSchedule(true);
  };

  const startEditSchedule = (schedule: Schedule) => {
    setEditingSchedule(schedule.id);
    setScheduleForm({
      name: schedule.name,
      template_id: schedule.template_id || '',
      hive_id: schedule.hive_id || '',
      frequency_type: schedule.frequency_type as any,
      frequency_value: schedule.frequency_value.toString(),
      next_due_date: schedule.next_due_date,
      is_active: schedule.is_active
    });
    setScheduleError(null);
    setScheduleSuccess(false);
    setShowCreateSchedule(true);
  };

  const handleCreateSchedule = async () => {
    try {
      setScheduleError(null);
      setScheduleSuccess(false);
      setSchedulesCreatedCount(0);

      // If editing, use the existing update logic
      if (editingSchedule) {
        const data: any = {
          name: scheduleForm.name,
          frequency_type: scheduleForm.frequency_type,
          frequency_value: parseInt(scheduleForm.frequency_value),
          next_due_date: scheduleForm.next_due_date,
          is_active: scheduleForm.is_active,
          template_id: scheduleForm.template_id || undefined,
          hive_id: scheduleForm.hive_id || undefined
        };

        await api.patch(`/maintenance/schedules/${editingSchedule}`, data);
        setScheduleSuccess(true);
        setTimeout(() => {
          setShowCreateSchedule(false);
          loadData();
        }, 1000);
        return;
      }

      // If creating new schedule and "All Hives" is selected (hive_id is empty)
      if (!scheduleForm.hive_id || scheduleForm.hive_id === '') {
        // Create separate schedules for each hive
        if (hives.length === 0) {
          setScheduleError('No hives found. Please create hives first.');
          return;
        }

        const schedulesToCreate = hives.map(hive => ({
          template_id: scheduleForm.template_id || undefined,
          hive_id: hive.id,
          name: `${scheduleForm.name} - ${hive.label}`,
          frequency_type: scheduleForm.frequency_type,
          frequency_value: parseInt(scheduleForm.frequency_value),
          next_due_date: scheduleForm.next_due_date,
          is_active: scheduleForm.is_active
        }));

        const res = await api.post('/maintenance/schedules/bulk', { schedules: schedulesToCreate });
        const count = res.data.count || schedulesToCreate.length;
        setSchedulesCreatedCount(count);
        setScheduleSuccess(true);
        // Update success message to show count
        setTimeout(() => {
          setShowCreateSchedule(false);
          setSchedulesCreatedCount(0);
          loadData();
        }, 2000); // Give more time to read the success message
      } else {
        // Create single schedule for specific hive
        const data: any = {
          name: scheduleForm.name,
          frequency_type: scheduleForm.frequency_type,
          frequency_value: parseInt(scheduleForm.frequency_value),
          next_due_date: scheduleForm.next_due_date,
          is_active: scheduleForm.is_active,
          template_id: scheduleForm.template_id || undefined,
          hive_id: scheduleForm.hive_id
        };

        await api.post('/maintenance/schedules', data);
        setScheduleSuccess(true);
        setTimeout(() => {
          setShowCreateSchedule(false);
          loadData();
        }, 1000);
      }
    } catch (error: any) {
      console.error('Failed to save schedule:', error);
      setScheduleError(error.response?.data?.error || 'Failed to save schedule');
    }
  };

  // Complete maintenance handlers
  const startCompleteMaintenance = async (schedule: Schedule) => {
    setCompletingSchedule(schedule.id);
    const template = templates.find(t => t.id === schedule.template_id);
    const checklistItems = template?.checklist_items || [];
    setCompletionForm({
      completed_date: new Date().toISOString().split('T')[0],
      notes: '',
      checklist_completed: checklistItems.map(() => false)
    });
    setCompletionError(null);
    setCompletionSuccess(false);
  };

  const handleCompleteMaintenance = async () => {
    if (!completingSchedule) return;

    try {
      setCompletionError(null);
      setCompletionSuccess(false);

      const schedule = schedules.find(s => s.id === completingSchedule);
      if (!schedule) return;

      const data: any = {
        hive_id: schedule.hive_id || '',
        completed_date: completionForm.completed_date,
        notes: completionForm.notes || undefined,
        checklist_completed: completionForm.checklist_completed.length > 0 ? completionForm.checklist_completed : undefined
      };

      await api.post(`/maintenance/schedules/${completingSchedule}/complete`, data);
      setCompletionSuccess(true);
      setTimeout(() => {
        setCompletingSchedule(null);
        loadData();
      }, 1000);
    } catch (error: any) {
      console.error('Failed to complete maintenance:', error);
      setCompletionError(error.response?.data?.error || 'Failed to complete maintenance');
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    const schedule = schedules.find(s => s.id === scheduleId);
    if (!schedule) return;

    const confirmMessage = `Are you sure you want to delete the schedule "${schedule.name}"? This action cannot be undone.`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      setDeletingSchedule(scheduleId);
      await api.delete(`/maintenance/schedules/${scheduleId}`);
      loadData();
    } catch (error: any) {
      console.error('Failed to delete schedule:', error);
      alert(error.response?.data?.error || 'Failed to delete schedule');
    } finally {
      setDeletingSchedule(null);
    }
  };

  // Bulk create handlers
  const handleBulkCreate = async () => {
    try {
      let hiveIds: string[] = [];
      
      if (bulkForm.all_hives) {
        hiveIds = hives.map(h => h.id);
      } else if (bulkForm.selected_apiary_id) {
        // Get hives for selected apiary
        const apiaryHives = hives.filter(h => {
          // We need to get apiary_id from hives - this might need API call
          // For now, use selected apiary hives if we have them
          return bulkForm.apiary_hive_ids.includes(h.id);
        });
        hiveIds = apiaryHives.map(h => h.id);
      } else {
        hiveIds = bulkForm.selected_hive_ids;
      }

      if (hiveIds.length === 0) {
        setScheduleError('Please select at least one hive');
        return;
      }

      const template = templates.find(t => t.id === bulkForm.template_id);
      if (!template) {
        setScheduleError('Please select a template');
        return;
      }

      const schedulesToCreate = hiveIds.map(hiveId => {
        const hive = hives.find(h => h.id === hiveId);
        return {
          template_id: bulkForm.template_id,
          hive_id: hiveId,
          name: `${template.name} - ${hive?.label || 'Hive'}`,
          frequency_type: bulkForm.frequency_type,
          frequency_value: parseInt(bulkForm.frequency_value),
          next_due_date: bulkForm.next_due_date,
          is_active: true
        };
      });

      await api.post('/maintenance/schedules/bulk', { schedules: schedulesToCreate });
      setShowBulkCreate(false);
      setScheduleSuccess(true);
      setTimeout(() => {
        loadData();
        setScheduleSuccess(false);
      }, 1000);
    } catch (error: any) {
      console.error('Failed to bulk create schedules:', error);
      setScheduleError(error.response?.data?.error || 'Failed to bulk create schedules');
    }
  };

  const getUpcomingScheduleTemplate = (schedule: Schedule): Template | undefined => {
    return templates.find(t => t.id === schedule.template_id);
  };

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date();
  };

  const isDueToday = (dueDate: string) => {
    const today = new Date().toISOString().split('T')[0];
    return dueDate === today;
  };

  if (loading) {
    return <div className="maintenance-loading">Loading...</div>;
  }

  const canManageTemplates = user?.role === 'admin' || user?.role === 'manager';

  return (
    <div className="maintenance-scheduling">
      <div className="page-header">
        <h2>Maintenance Scheduling</h2>
        <div className="page-actions">
          {canManageTemplates && (
            <>
              <button onClick={startCreateTemplate} className="btn-primary">
                + Create Template
              </button>
              <button onClick={startCreateSchedule} className="btn-primary">
                + Create Schedule
              </button>
              <button onClick={() => setShowBulkCreate(true)} className="btn-primary">
                Bulk Create
              </button>
            </>
          )}
        </div>
      </div>

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
        <button
          className={activeTab === 'stats' ? 'active' : ''}
          onClick={() => setActiveTab('stats')}
        >
          Statistics
        </button>
      </div>

      {/* Template Create/Edit Modal */}
      {showCreateTemplate && (
        <div className="create-form-container">
          <div className="apiary-edit-form">
            <h3>{editingTemplate ? 'Edit Template' : 'Create Template'}</h3>
            <div className="form-group">
              <label>Name *</label>
              <input
                type="text"
                value={templateForm.name}
                onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                value={templateForm.description}
                onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="form-group">
              <label>Task Type *</label>
              <select
                value={templateForm.task_type}
                onChange={(e) => setTemplateForm({ ...templateForm, task_type: e.target.value })}
              >
                <option value="maintenance">Maintenance</option>
                <option value="inspection_due">Inspection Due</option>
                <option value="treatment_due">Treatment Due</option>
                <option value="feeding">Feeding</option>
                <option value="harvest">Harvest</option>
              </select>
            </div>
            <div className="form-group">
              <label>Default Duration (days)</label>
              <input
                type="number"
                value={templateForm.default_duration_days}
                onChange={(e) => setTemplateForm({ ...templateForm, default_duration_days: e.target.value })}
                min="0"
              />
            </div>
            <div className="form-group">
              <label>Instructions</label>
              <textarea
                value={templateForm.instructions}
                onChange={(e) => setTemplateForm({ ...templateForm, instructions: e.target.value })}
                rows={4}
              />
            </div>
            <div className="form-group">
              <label>Checklist Items</label>
              {templateForm.checklist_items.map((item, index) => (
                <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => updateChecklistItem(index, e.target.value)}
                    placeholder="Checklist item"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => removeChecklistItem(index)}
                    className="btn-secondary"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addChecklistItem}
                className="btn-secondary"
                style={{ marginTop: '0.5rem' }}
              >
                + Add Checklist Item
              </button>
            </div>
            {templateError && <div className="error-message">{templateError}</div>}
            {templateSuccess && <div className="success-message">Template saved successfully!</div>}
            <div className="form-actions">
              <button onClick={handleCreateTemplate} className="btn-primary">
                {editingTemplate ? 'Update' : 'Create'}
              </button>
              <button
                onClick={() => {
                  setShowCreateTemplate(false);
                  setTemplateError(null);
                  setTemplateSuccess(false);
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Create/Edit Modal */}
      {showCreateSchedule && (
        <div className="create-form-container">
          <div className="apiary-edit-form">
            <h3>{editingSchedule ? 'Edit Schedule' : 'Create Schedule'}</h3>
            <div className="form-group">
              <label>Name *</label>
              <input
                type="text"
                value={scheduleForm.name}
                onChange={(e) => setScheduleForm({ ...scheduleForm, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Template</label>
              <select
                value={scheduleForm.template_id}
                onChange={(e) => setScheduleForm({ ...scheduleForm, template_id: e.target.value })}
              >
                <option value="">None</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Hive</label>
              <select
                value={scheduleForm.hive_id}
                onChange={(e) => setScheduleForm({ ...scheduleForm, hive_id: e.target.value })}
              >
                <option value="">All Hives</option>
                {hives.map(h => (
                  <option key={h.id} value={h.id}>{h.label} ({h.public_id})</option>
                ))}
              </select>
              {!editingSchedule && (!scheduleForm.hive_id || scheduleForm.hive_id === '') && (
                <small style={{ color: 'var(--gray-600)', fontSize: '0.85rem', marginTop: '0.25rem', display: 'block' }}>
                  Note: Selecting "All Hives" will create a separate schedule for each hive ({hives.length} schedules will be created)
                </small>
              )}
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Frequency Type *</label>
                <select
                  value={scheduleForm.frequency_type}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, frequency_type: e.target.value as any })}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div className="form-group">
                <label>Frequency Value *</label>
                <input
                  type="number"
                  value={scheduleForm.frequency_value}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, frequency_value: e.target.value })}
                  min="1"
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label>Next Due Date *</label>
              <input
                type="date"
                value={scheduleForm.next_due_date}
                onChange={(e) => setScheduleForm({ ...scheduleForm, next_due_date: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={scheduleForm.is_active}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, is_active: e.target.checked })}
                />
                Active
              </label>
            </div>
            {scheduleError && <div className="error-message">{scheduleError}</div>}
            {scheduleSuccess && (
              <div className="success-message">
                {schedulesCreatedCount > 0 
                  ? `Created ${schedulesCreatedCount} schedules successfully!`
                  : 'Schedule saved successfully!'}
              </div>
            )}
            <div className="form-actions">
              <button onClick={handleCreateSchedule} className="btn-primary">
                {editingSchedule ? 'Update' : 'Create'}
              </button>
              <button
                onClick={() => {
                  setShowCreateSchedule(false);
                  setScheduleError(null);
                  setScheduleSuccess(false);
                  setSchedulesCreatedCount(0);
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Maintenance Modal */}
      {completingSchedule && (
        <div className="create-form-container">
          <div className="apiary-edit-form">
            <h3>Complete Maintenance</h3>
            {(() => {
              const schedule = schedules.find(s => s.id === completingSchedule);
              const template = schedule ? getUpcomingScheduleTemplate(schedule) : undefined;
              const checklistItems = template?.checklist_items || [];
              
              return (
                <>
                  <div className="form-group">
                    <label>Completed Date *</label>
                    <input
                      type="date"
                      value={completionForm.completed_date}
                      onChange={(e) => setCompletionForm({ ...completionForm, completed_date: e.target.value })}
                      required
                    />
                  </div>
                  {checklistItems.length > 0 && (
                    <div className="form-group">
                      <label>Checklist</label>
                      {checklistItems.map((item, index) => (
                        <label key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <input
                            type="checkbox"
                            checked={completionForm.checklist_completed[index] || false}
                            onChange={(e) => {
                              const newCompleted = [...completionForm.checklist_completed];
                              newCompleted[index] = e.target.checked;
                              setCompletionForm({ ...completionForm, checklist_completed: newCompleted });
                            }}
                          />
                          <span>{item}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  <div className="form-group">
                    <label>Notes</label>
                    <textarea
                      value={completionForm.notes}
                      onChange={(e) => setCompletionForm({ ...completionForm, notes: e.target.value })}
                      rows={4}
                    />
                  </div>
                  {completionError && <div className="error-message">{completionError}</div>}
                  {completionSuccess && <div className="success-message">Maintenance completed successfully!</div>}
                  <div className="form-actions">
                    <button onClick={handleCompleteMaintenance} className="btn-primary">
                      Complete
                    </button>
                    <button
                      onClick={() => {
                        setCompletingSchedule(null);
                        setCompletionError(null);
                        setCompletionSuccess(false);
                      }}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Bulk Create Modal */}
      {showBulkCreate && (
        <div className="create-form-container">
          <div className="apiary-edit-form">
            <h3>Bulk Create Schedules</h3>
            <div className="form-group">
              <label>Template *</label>
              <select
                value={bulkForm.template_id}
                onChange={(e) => setBulkForm({ ...bulkForm, template_id: e.target.value })}
                required
              >
                <option value="">Select Template</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Frequency Type *</label>
                <select
                  value={bulkForm.frequency_type}
                  onChange={(e) => setBulkForm({ ...bulkForm, frequency_type: e.target.value as any })}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div className="form-group">
                <label>Frequency Value *</label>
                <input
                  type="number"
                  value={bulkForm.frequency_value}
                  onChange={(e) => setBulkForm({ ...bulkForm, frequency_value: e.target.value })}
                  min="1"
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label>Start Date *</label>
              <input
                type="date"
                value={bulkForm.next_due_date}
                onChange={(e) => setBulkForm({ ...bulkForm, next_due_date: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={bulkForm.all_hives}
                  onChange={(e) => setBulkForm({ ...bulkForm, all_hives: e.target.checked, selected_hive_ids: [], selected_apiary_id: '' })}
                />
                All Hives
              </label>
            </div>
            {!bulkForm.all_hives && (
              <>
                <div className="form-group">
                  <label>Select by Apiary</label>
                  <select
                    value={bulkForm.selected_apiary_id}
                    onChange={async (e) => {
                      const apiaryId = e.target.value;
                      setBulkForm({ ...bulkForm, selected_apiary_id: apiaryId });
                      if (apiaryId) {
                        try {
                          const res = await api.get(`/apiaries/${apiaryId}/hives`);
                          const apiaryHives = res.data.hives || [];
                          setBulkForm(prev => ({
                            ...prev,
                            apiary_hive_ids: apiaryHives.map((h: any) => h.id)
                          }));
                        } catch (error) {
                          console.error('Failed to load apiary hives:', error);
                        }
                      }
                    }}
                  >
                    <option value="">Select Apiary</option>
                    {apiaries.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                {!bulkForm.selected_apiary_id && (
                  <div className="form-group">
                    <label>Select Hives</label>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px', padding: '0.5rem' }}>
                      {hives.map(h => (
                        <label key={h.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <input
                            type="checkbox"
                            checked={bulkForm.selected_hive_ids.includes(h.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setBulkForm({ ...bulkForm, selected_hive_ids: [...bulkForm.selected_hive_ids, h.id] });
                              } else {
                                setBulkForm({ ...bulkForm, selected_hive_ids: bulkForm.selected_hive_ids.filter(id => id !== h.id) });
                              }
                            }}
                          />
                          <span>{h.label} ({h.public_id})</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            {scheduleError && <div className="error-message">{scheduleError}</div>}
            {scheduleSuccess && <div className="success-message">Schedules created successfully!</div>}
            <div className="form-actions">
              <button onClick={handleBulkCreate} className="btn-primary">
                Create Schedules
              </button>
              <button
                onClick={() => {
                  setShowBulkCreate(false);
                  setScheduleError(null);
                  setScheduleSuccess(false);
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'upcoming' && (
        <div className="upcoming-maintenance">
          <h3>Upcoming Maintenance</h3>
          {upcoming.length === 0 ? (
            <p>No upcoming maintenance tasks</p>
          ) : (
            <ul>
              {upcoming.map((schedule) => {
                const overdue = isOverdue(schedule.next_due_date);
                const dueToday = isDueToday(schedule.next_due_date);
                return (
                  <li key={schedule.id} className={`schedule-item ${overdue ? 'overdue' : ''} ${dueToday ? 'due-today' : ''}`}>
                    <div className="schedule-info">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                        <div>
                          <h4>{schedule.name}</h4>
                          {schedule.hive_label && <p>Hive: {schedule.hive_label}</p>}
                          <p>Due: {new Date(schedule.next_due_date).toLocaleDateString()}</p>
                          <p>Frequency: {schedule.frequency_value} {schedule.frequency_type}</p>
                          {overdue && <span className="status-badge overdue-badge">Overdue</span>}
                          {dueToday && !overdue && <span className="status-badge due-today-badge">Due Today</span>}
                        </div>
                        <button
                          onClick={() => startCompleteMaintenance(schedule)}
                          className="btn-primary"
                          style={{ marginLeft: '1rem' }}
                        >
                          Complete
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div>
                        <h4>{schedule.name}</h4>
                        {schedule.template_name && <p>Template: {schedule.template_name}</p>}
                        {schedule.hive_label && <p>Hive: {schedule.hive_label}</p>}
                        <p>Next Due: {new Date(schedule.next_due_date).toLocaleDateString()}</p>
                        <p>Frequency: {schedule.frequency_value} {schedule.frequency_type}</p>
                        <span className={`status ${schedule.is_active ? 'active' : 'inactive'}`}>
                          {schedule.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => startEditSchedule(schedule)}
                          className="btn-edit"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteSchedule(schedule.id)}
                          disabled={deletingSchedule === schedule.id}
                          className="btn-secondary"
                          style={{ 
                            background: '#fee', 
                            color: '#c33',
                            borderColor: '#fcc'
                          }}
                        >
                          {deletingSchedule === schedule.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div>
                        <h4>{template.name}</h4>
                        {template.description && <p>{template.description}</p>}
                        <p>Type: {template.task_type}</p>
                        {template.default_duration_days && (
                          <p>Duration: {template.default_duration_days} days</p>
                        )}
                        {template.checklist_items && template.checklist_items.length > 0 && (
                          <p>Checklist: {template.checklist_items.length} items</p>
                        )}
                      </div>
                      {canManageTemplates && (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            onClick={() => startEditTemplate(template)}
                            className="btn-edit"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(template.id)}
                            disabled={deletingTemplate === template.id}
                            className="btn-secondary"
                            style={{ 
                              background: '#fee', 
                              color: '#c33',
                              borderColor: '#fcc'
                            }}
                          >
                            {deletingTemplate === template.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="stats-container">
          <h3>Maintenance Statistics</h3>
          {statsLoading ? (
            <p>Loading statistics...</p>
          ) : stats ? (
            <div className="stats-grid">
              <div className="stat-card">
                <h4>Total Schedules</h4>
                <div className="stat-value">{stats.total_schedules || 0}</div>
                <div className="stat-detail">
                  Active: {stats.active_schedules || 0} | Inactive: {stats.inactive_schedules || 0}
                </div>
              </div>
              <div className="stat-card">
                <h4>Completion Rate (30 days)</h4>
                <div className="stat-value">{stats.completion_rate_30d ? `${(stats.completion_rate_30d * 100).toFixed(1)}%` : 'N/A'}</div>
              </div>
              <div className="stat-card">
                <h4>Overdue Maintenance</h4>
                <div className="stat-value">{stats.overdue_count || 0}</div>
              </div>
              <div className="stat-card">
                <h4>Avg Days to Complete</h4>
                <div className="stat-value">{stats.avg_days_to_complete ? stats.avg_days_to_complete.toFixed(1) : 'N/A'}</div>
              </div>
            </div>
          ) : (
            <p>No statistics available</p>
          )}
        </div>
      )}
    </div>
  );
}
