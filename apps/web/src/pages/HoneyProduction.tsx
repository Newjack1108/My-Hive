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
  apiary_id?: string;
  apiary_name?: string;
}

interface Apiary {
  id: string;
  name: string;
}

interface Hive {
  id: string;
  label: string;
  apiary_id: string;
  apiary_name?: string;
}

interface Stats {
  total: { total_kg: number; harvest_count: number };
  by_hive: any[];
  by_month: any[];
  by_apiary?: any[];
}

export default function HoneyProduction() {
  const [harvests, setHarvests] = useState<Harvest[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [apiaries, setApiaries] = useState<Apiary[]>([]);
  const [hives, setHives] = useState<Hive[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApiary, setSelectedApiary] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    apiary_id: '',
    hive_id: '',
    harvest_date: new Date().toISOString().split('T')[0],
    weight_kg: '',
    frames: '',
    notes: ''
  });

  useEffect(() => {
    loadApiaries();
    loadHives();
    loadData();
  }, []);

  useEffect(() => {
    loadData();
    if (selectedApiary) {
      loadHives(selectedApiary);
    } else {
      loadHives();
    }
  }, [selectedApiary]);

  const loadApiaries = async () => {
    try {
      const apiariesRes = await api.get('/apiaries');
      setApiaries(apiariesRes.data.apiaries || []);
    } catch (error) {
      console.error('Failed to load apiaries:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [harvestsRes, statsRes] = await Promise.all([
        api.get(selectedApiary ? `/honey/harvests?apiary_id=${selectedApiary}` : '/honey/harvests'),
        api.get(selectedApiary ? `/honey/stats?apiary_id=${selectedApiary}` : '/honey/stats')
      ]);
      setHarvests(harvestsRes.data.harvests);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Failed to load honey data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadHives = async (apiaryId?: string) => {
    try {
      const url = apiaryId ? `/hives?apiary_id=${apiaryId}` : '/hives';
      const hivesRes = await api.get(url);
      setHives(hivesRes.data.hives || []);
    } catch (error) {
      console.error('Failed to load hives:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/honey/harvests', {
        hive_id: formData.hive_id,
        harvest_date: formData.harvest_date,
        weight_kg: parseFloat(formData.weight_kg),
        frames: formData.frames ? parseInt(formData.frames) : undefined,
        notes: formData.notes || undefined
      });
      setShowForm(false);
      setFormData({
        apiary_id: '',
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

  const handleApiaryChange = (apiaryId: string) => {
    setSelectedApiary(apiaryId);
    setFormData({ ...formData, apiary_id: apiaryId, hive_id: '' });
  };

  const filteredHives = formData.apiary_id 
    ? hives.filter(h => h.apiary_id === formData.apiary_id)
    : hives;

  if (loading) {
    return <div className="honey-loading">Loading...</div>;
  }

  // Group harvests by apiary
  const harvestsByApiary = harvests.reduce((acc, harvest) => {
    const apiaryKey = harvest.apiary_id || 'no-apiary';
    const apiaryName = harvest.apiary_name || 'No Apiary';
    if (!acc[apiaryKey]) {
      acc[apiaryKey] = { apiary_id: apiaryKey, apiary_name: apiaryName, harvests: [] };
    }
    acc[apiaryKey].harvests.push(harvest);
    return acc;
  }, {} as Record<string, { apiary_id: string; apiary_name: string; harvests: Harvest[] }>);

  return (
    <div className="honey-production">
      <div className="page-header">
        <img src="/bee-icon.png" alt="" className="page-icon" />
        <h2>Honey Production</h2>
        <div className="page-actions">
          <button onClick={() => setShowForm(!showForm)} className="btn-primary">
            {showForm ? 'Cancel' : 'Record Harvest'}
          </button>
        </div>
      </div>

      <div className="apiary-filter">
        <label htmlFor="apiary-filter">Filter by Apiary:</label>
        <select
          id="apiary-filter"
          value={selectedApiary}
          onChange={(e) => handleApiaryChange(e.target.value)}
        >
          <option value="">All Apiaries</option>
          {apiaries.map(apiary => (
            <option key={apiary.id} value={apiary.id}>{apiary.name}</option>
          ))}
        </select>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="harvest-form">
          <div className="form-group">
            <label>Apiary *</label>
            <select
              value={formData.apiary_id}
              onChange={(e) => {
                const apiaryId = e.target.value;
                setFormData({ ...formData, apiary_id: apiaryId, hive_id: '' });
              }}
              required
            >
              <option value="">Select Apiary</option>
              {apiaries.map(apiary => (
                <option key={apiary.id} value={apiary.id}>{apiary.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Hive *</label>
            <select
              value={formData.hive_id}
              onChange={(e) => setFormData({ ...formData, hive_id: e.target.value })}
              required
              disabled={!formData.apiary_id}
            >
              <option value="">Select Hive</option>
              {filteredHives.map(hive => (
                <option key={hive.id} value={hive.id}>
                  {hive.label} {hive.apiary_name ? `(${hive.apiary_name})` : ''}
                </option>
              ))}
            </select>
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
          {!selectedApiary && stats.by_apiary && stats.by_apiary.length > 0 && (
            <>
              {stats.by_apiary.map((apiaryStat: any) => (
                <div key={apiaryStat.apiary_id} className="stat-card">
                  <h3>{apiaryStat.apiary_name || 'No Apiary'}</h3>
                  <div className="stat-value">
                    {(typeof apiaryStat.total_kg === 'number' 
                      ? apiaryStat.total_kg 
                      : parseFloat(apiaryStat.total_kg) || 0
                    ).toFixed(2)} kg
                  </div>
                  <div className="stat-label">{apiaryStat.harvest_count || 0} harvests</div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      <div className="harvests-list">
        <h3>{selectedApiary ? 'Harvests' : 'Harvests by Apiary'}</h3>
        {harvests.length === 0 ? (
          <p>No harvests recorded</p>
        ) : selectedApiary ? (
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
        ) : (
          Object.values(harvestsByApiary).map((group) => (
            <div key={group.apiary_id} className="apiary-harvest-group">
              <h4 className="apiary-group-header">{group.apiary_name}</h4>
              <ul>
                {group.harvests.map((harvest) => (
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
            </div>
          ))
        )}
      </div>
    </div>
  );
}
