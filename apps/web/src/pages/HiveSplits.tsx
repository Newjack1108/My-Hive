import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import './HiveSplits.css';

interface HiveSplit {
  id: string;
  parent_hive_id: string;
  parent_hive_label?: string;
  parent_hive_public_id?: string;
  split_date: string;
  split_method: 'walk_away' | 'queen_cell' | 'queen_introduction' | 'nuc_creation' | 'other';
  frames_moved: number;
  brood_frames: number;
  honey_frames: number;
  pollen_frames: number;
  queen_source?: 'parent_hive' | 'purchased' | 'grafted' | 'cell' | 'unknown';
  queen_id?: string;
  queen_name?: string;
  notes?: string;
  created_by_name?: string;
  created_at: string;
  child_hives?: Array<{
    id: string;
    label: string;
    public_id: string;
    status: string;
  }>;
}

interface Hive {
  id: string;
  label: string;
  public_id: string;
}

interface Queen {
  id: string;
  name?: string;
  status: string;
}

export default function HiveSplits() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [splits, setSplits] = useState<HiveSplit[]>([]);
  const [hives, setHives] = useState<Hive[]>([]);
  const [queens, setQueens] = useState<Queen[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedSplit, setSelectedSplit] = useState<HiveSplit | null>(null);
  const [formData, setFormData] = useState({
    parent_hive_id: '',
    split_date: new Date().toISOString().split('T')[0],
    split_method: 'walk_away' as 'walk_away' | 'queen_cell' | 'queen_introduction' | 'nuc_creation' | 'other',
    frames_moved: 0,
    brood_frames: 0,
    honey_frames: 0,
    pollen_frames: 0,
    queen_source: '' as '' | 'parent_hive' | 'purchased' | 'grafted' | 'cell' | 'unknown',
    queen_id: '',
    notes: '',
    child_hive_ids: [] as string[]
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [filterParentHive, setFilterParentHive] = useState<string>('');

  useEffect(() => {
    loadData();
    // Check for parent_hive_id in URL params
    const params = new URLSearchParams(window.location.search);
    const parentHiveId = params.get('parent_hive_id');
    if (parentHiveId) {
      setFilterParentHive(parentHiveId);
      setFormData(prev => ({ ...prev, parent_hive_id: parentHiveId }));
      setShowForm(true);
    }
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [splitsRes, hivesRes, queensRes] = await Promise.all([
        api.get('/splits'),
        api.get('/hives'),
        api.get('/queens')
      ]);
      setSplits(splitsRes.data.splits || []);
      setHives(hivesRes.data.hives || []);
      setQueens(queensRes.data.queens || []);
    } catch (error: any) {
      console.error('Failed to load data:', error);
      setError(error.response?.data?.error || 'Failed to load splits');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      setSuccess(false);

      const submitData: any = {
        parent_hive_id: formData.parent_hive_id,
        split_date: formData.split_date,
        split_method: formData.split_method,
        frames_moved: formData.frames_moved,
        brood_frames: formData.brood_frames,
        honey_frames: formData.honey_frames,
        pollen_frames: formData.pollen_frames,
        notes: formData.notes || undefined
      };

      if (formData.queen_source) {
        submitData.queen_source = formData.queen_source;
      }
      if (formData.queen_id) {
        submitData.queen_id = formData.queen_id;
      }
      if (formData.child_hive_ids.length > 0) {
        submitData.child_hive_ids = formData.child_hive_ids;
      }

      await api.post('/splits', submitData);
      setSuccess(true);
      setTimeout(() => {
        setShowForm(false);
        setFormData({
          parent_hive_id: '',
          split_date: new Date().toISOString().split('T')[0],
          split_method: 'walk_away',
          frames_moved: 0,
          brood_frames: 0,
          honey_frames: 0,
          pollen_frames: 0,
          queen_source: '',
          queen_id: '',
          notes: '',
          child_hive_ids: []
        });
        loadData();
      }, 1000);
    } catch (error: any) {
      console.error('Failed to create split:', error);
      setError(error.response?.data?.error || 'Failed to create split');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this split?')) return;
    try {
      await api.delete(`/splits/${id}`);
      loadData();
    } catch (error: any) {
      console.error('Failed to delete split:', error);
      alert(error.response?.data?.error || 'Failed to delete split');
    }
  };

  const filteredSplits = filterParentHive
    ? splits.filter(s => s.parent_hive_id === filterParentHive)
    : splits;

  if (loading) {
    return <div className="splits-loading">Loading...</div>;
  }

  return (
    <div className="hive-splits">
      <div className="page-header">
        <img src="/hive-icon.png" alt="" className="page-icon" />
        <h2>Hive Splits & Nucs</h2>
        <div className="page-actions">
          {(user?.role === 'admin' || user?.role === 'manager' || user?.role === 'inspector') && (
            <button onClick={() => setShowForm(true)} className="btn-primary">
              + Create Split
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="error-message">{error}</div>
      )}

      {showForm && (
        <div className="create-form-container">
          <div className="split-form">
            <h3>Create New Split</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Parent Hive *</label>
                <select
                  value={formData.parent_hive_id}
                  onChange={(e) => setFormData({ ...formData, parent_hive_id: e.target.value })}
                  required
                >
                  <option value="">Select a hive</option>
                  {hives.filter(h => h.id !== formData.parent_hive_id).map((hive) => (
                    <option key={hive.id} value={hive.id}>
                      {hive.label} ({hive.public_id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Split Date *</label>
                <input
                  type="date"
                  value={formData.split_date}
                  onChange={(e) => setFormData({ ...formData, split_date: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Split Method *</label>
                <select
                  value={formData.split_method}
                  onChange={(e) => setFormData({ ...formData, split_method: e.target.value as any })}
                  required
                >
                  <option value="walk_away">Walk Away</option>
                  <option value="queen_cell">Queen Cell</option>
                  <option value="queen_introduction">Queen Introduction</option>
                  <option value="nuc_creation">Nuc Creation</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Frames Moved</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.frames_moved}
                    onChange={(e) => setFormData({ ...formData, frames_moved: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="form-group">
                  <label>Brood Frames</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.brood_frames}
                    onChange={(e) => setFormData({ ...formData, brood_frames: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Honey Frames</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.honey_frames}
                    onChange={(e) => setFormData({ ...formData, honey_frames: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="form-group">
                  <label>Pollen Frames</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.pollen_frames}
                    onChange={(e) => setFormData({ ...formData, pollen_frames: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Queen Source</label>
                <select
                  value={formData.queen_source}
                  onChange={(e) => setFormData({ ...formData, queen_source: e.target.value as any, queen_id: '' })}
                >
                  <option value="">Not specified</option>
                  <option value="parent_hive">From Parent Hive</option>
                  <option value="purchased">Purchased</option>
                  <option value="grafted">Grafted</option>
                  <option value="cell">Queen Cell</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>

              {formData.queen_source && formData.queen_source !== 'parent_hive' && (
                <div className="form-group">
                  <label>Queen</label>
                  <select
                    value={formData.queen_id}
                    onChange={(e) => setFormData({ ...formData, queen_id: e.target.value })}
                  >
                    <option value="">Select a queen (optional)</option>
                    {queens.filter(q => q.status === 'active').map((queen) => (
                      <option key={queen.id} value={queen.id}>
                        {queen.name || `Queen ${queen.id.slice(0, 8)}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label>Link Existing Hives (Optional)</label>
                <select
                  multiple
                  value={formData.child_hive_ids}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value);
                    setFormData({ ...formData, child_hive_ids: selected });
                  }}
                  style={{ minHeight: '100px' }}
                >
                  {hives.map((hive) => (
                    <option key={hive.id} value={hive.id}>
                      {hive.label} ({hive.public_id})
                    </option>
                  ))}
                </select>
                <small>Hold Ctrl/Cmd to select multiple hives created from this split</small>
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
                <div className="success-message">Split created successfully!</div>
              )}

              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  Create Split
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setFormData({
                      parent_hive_id: '',
                      split_date: new Date().toISOString().split('T')[0],
                      split_method: 'walk_away',
                      frames_moved: 0,
                      brood_frames: 0,
                      honey_frames: 0,
                      pollen_frames: 0,
                      queen_source: '',
                      queen_id: '',
                      notes: '',
                      child_hive_ids: []
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

      {selectedSplit && (
        <div className="split-detail-modal" onClick={() => setSelectedSplit(null)}>
          <div className="split-detail-content" onClick={(e) => e.stopPropagation()}>
            <h3>Split Details</h3>
            <div className="split-detail-info">
              <p><strong>Parent Hive:</strong> 
                <Link to={`/hives/${selectedSplit.parent_hive_id}`}>
                  {selectedSplit.parent_hive_label} ({selectedSplit.parent_hive_public_id})
                </Link>
              </p>
              <p><strong>Date:</strong> {new Date(selectedSplit.split_date).toLocaleDateString()}</p>
              <p><strong>Method:</strong> {selectedSplit.split_method.replace('_', ' ')}</p>
              <p><strong>Frames:</strong> {selectedSplit.frames_moved} total ({selectedSplit.brood_frames} brood, {selectedSplit.honey_frames} honey, {selectedSplit.pollen_frames} pollen)</p>
              {selectedSplit.queen_source && (
                <p><strong>Queen Source:</strong> {selectedSplit.queen_source.replace('_', ' ')}</p>
              )}
              {selectedSplit.queen_name && (
                <p><strong>Queen:</strong> {selectedSplit.queen_name}</p>
              )}
              {selectedSplit.notes && (
                <p><strong>Notes:</strong> {selectedSplit.notes}</p>
              )}
              {selectedSplit.child_hives && selectedSplit.child_hives.length > 0 && (
                <div>
                  <strong>Child Hives:</strong>
                  <ul>
                    {selectedSplit.child_hives.map((child) => (
                      <li key={child.id}>
                        <Link to={`/hives/${child.id}`}>
                          {child.label} ({child.public_id})
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <button onClick={() => setSelectedSplit(null)} className="btn-secondary">
              Close
            </button>
          </div>
        </div>
      )}

      <div className="splits-filters">
        <label>
          Filter by Parent Hive:
          <select
            value={filterParentHive}
            onChange={(e) => setFilterParentHive(e.target.value)}
          >
            <option value="">All Hives</option>
            {hives.map((hive) => (
              <option key={hive.id} value={hive.id}>
                {hive.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {filteredSplits.length === 0 ? (
        <p className="empty-state">No splits recorded yet</p>
      ) : (
        <div className="splits-list">
          {filteredSplits.map((split) => (
            <div key={split.id} className="split-card">
              <div className="split-header">
                <h3>
                  <Link to={`/hives/${split.parent_hive_id}`}>
                    {split.parent_hive_label} ({split.parent_hive_public_id})
                  </Link>
                </h3>
                <div className="split-actions">
                  <button onClick={() => setSelectedSplit(split)} className="btn-secondary">
                    View Details
                  </button>
                  {(user?.role === 'admin' || user?.role === 'manager') && (
                    <button onClick={() => handleDelete(split.id)} className="btn-danger">
                      Delete
                    </button>
                  )}
                </div>
              </div>
              <div className="split-info">
                <p><strong>Date:</strong> {new Date(split.split_date).toLocaleDateString()}</p>
                <p><strong>Method:</strong> {split.split_method.replace('_', ' ')}</p>
                <p><strong>Frames:</strong> {split.frames_moved} total</p>
                {split.child_hives && split.child_hives.length > 0 && (
                  <p><strong>Child Hives:</strong> {split.child_hives.length}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
