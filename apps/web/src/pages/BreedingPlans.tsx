import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import './BreedingPlans.css';

interface BreedingPlan {
  id: string;
  name: string;
  description?: string;
  target_traits?: any;
  timeline_start?: string;
  timeline_end?: string;
  status: string;
}

export default function BreedingPlans() {
  const [plans, setPlans] = useState<BreedingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    timeline_start: '',
    timeline_end: '',
    status: 'planning'
  });

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const res = await api.get('/queens/breeding-plans');
      setPlans(res.data.breeding_plans);
    } catch (error) {
      console.error('Failed to load breeding plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/queens/breeding-plans', formData);
      setShowForm(false);
      setFormData({
        name: '',
        description: '',
        timeline_start: '',
        timeline_end: '',
        status: 'planning'
      });
      loadPlans();
    } catch (error) {
      console.error('Failed to create breeding plan:', error);
      alert('Failed to create breeding plan');
    }
  };

  if (loading) {
    return <div className="breeding-plans-loading">Loading...</div>;
  }

  return (
    <div className="breeding-plans">
      <div className="breeding-plans-header">
        <h2>Breeding Plans</h2>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          {showForm ? 'Cancel' : 'New Plan'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="breeding-plan-form">
          <div className="form-group">
            <label>Plan Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
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
              <label>Start Date</label>
              <input
                type="date"
                value={formData.timeline_start}
                onChange={(e) => setFormData({ ...formData, timeline_start: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>End Date</label>
              <input
                type="date"
                value={formData.timeline_end}
                onChange={(e) => setFormData({ ...formData, timeline_end: e.target.value })}
              />
            </div>
          </div>
          <div className="form-group">
            <label>Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            >
              <option value="planning">Planning</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <button type="submit" className="btn-primary">Create Plan</button>
        </form>
      )}

      <div className="plans-list">
        {plans.length === 0 ? (
          <p>No breeding plans found</p>
        ) : (
          <ul>
            {plans.map((plan) => (
              <li key={plan.id} className="plan-item">
                <div className="plan-info">
                  <h3>{plan.name}</h3>
                  {plan.description && <p>{plan.description}</p>}
                  <div className="plan-details">
                    {plan.timeline_start && (
                      <span>Start: {new Date(plan.timeline_start).toLocaleDateString()}</span>
                    )}
                    {plan.timeline_end && (
                      <span>End: {new Date(plan.timeline_end).toLocaleDateString()}</span>
                    )}
                    <span className={`status-${plan.status}`}>{plan.status}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
