import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import './HoneyProduction.css';

interface Harvest {
  id: string;
  hive_id: string;
  harvest_date: string;
  weight_kg: number;
  frames?: number;
  notes?: string;
  hive_label?: string;
}

interface Stats {
  total: { total_kg: number; harvest_count: number };
  by_hive: any[];
  by_month: any[];
}

export default function HoneyProduction() {
  const [harvests, setHarvests] = useState<Harvest[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    hive_id: '',
    harvest_date: new Date().toISOString().split('T')[0],
    weight_kg: '',
    frames: '',
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [harvestsRes, statsRes] = await Promise.all([
        api.get('/honey/harvests'),
        api.get('/honey/stats')
      ]);
      setHarvests(harvestsRes.data.harvests);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Failed to load honey data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/honey/harvests', {
        ...formData,
        weight_kg: parseFloat(formData.weight_kg),
        frames: formData.frames ? parseInt(formData.frames) : undefined
      });
      setShowForm(false);
      setFormData({
        hive_id: '',
        harvest_date: new Date().toISOString().split('T')[0],
        weight_kg: '',
        frames: '',
        notes: ''
      });
      loadData();
    } catch (error) {
      console.error('Failed to create harvest:', error);
      alert('Failed to record harvest');
    }
  };

  if (loading) {
    return <div className="honey-loading">Loading...</div>;
  }

  return (
    <div className="honey-production">
      <div className="honey-header">
        <h2>Honey Production</h2>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          {showForm ? 'Cancel' : 'Record Harvest'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="harvest-form">
          <div className="form-group">
            <label>Hive ID *</label>
            <input
              type="text"
              value={formData.hive_id}
              onChange={(e) => setFormData({ ...formData, hive_id: e.target.value })}
              required
              placeholder="Enter hive UUID"
            />
          </div>
          <div className="form-group">
            <label>Harvest Date *</label>
            <input
              type="date"
              value={formData.harvest_date}
              onChange={(e) => setFormData({ ...formData, harvest_date: e.target.value })}
              required
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Weight (kg) *</label>
              <input
                type="number"
                step="0.01"
                value={formData.weight_kg}
                onChange={(e) => setFormData({ ...formData, weight_kg: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Frames</label>
              <input
                type="number"
                value={formData.frames}
                onChange={(e) => setFormData({ ...formData, frames: e.target.value })}
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
          <button type="submit" className="btn-primary">Record Harvest</button>
        </form>
      )}

      {stats && stats.total && (
        <div className="honey-stats">
          <div className="stat-card">
            <h3>Total Production</h3>
            <div className="stat-value">
              {(typeof stats.total.total_kg === 'number' 
                ? stats.total.total_kg 
                : parseFloat(stats.total.total_kg) || 0
              ).toFixed(2)} kg
            </div>
            <div className="stat-label">{stats.total.harvest_count || 0} harvests</div>
          </div>
        </div>
      )}

      <div className="harvests-list">
        <h3>Recent Harvests</h3>
        {harvests.length === 0 ? (
          <p>No harvests recorded</p>
        ) : (
          <ul>
            {harvests.map((harvest) => (
              <li key={harvest.id} className="harvest-item">
                <div className="harvest-info">
                  <h4>{harvest.hive_label || harvest.hive_id}</h4>
                  <p>Date: {new Date(harvest.harvest_date).toLocaleDateString()}</p>
                  <p>Weight: {harvest.weight_kg} kg</p>
                  {harvest.frames && <p>Frames: {harvest.frames}</p>}
                  {harvest.notes && <p className="notes">{harvest.notes}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
