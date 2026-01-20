import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';
import './QueenRecords.css';

interface Queen {
  id: string;
  hive_id?: string;
  name?: string;
  lineage?: string;
  birth_date?: string;
  status: string;
  notes?: string;
  hive_label?: string;
}

export default function QueenRecords() {
  const [queens, setQueens] = useState<Queen[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    hive_id: '',
    name: '',
    lineage: '',
    birth_date: '',
    status: 'active',
    notes: ''
  });

  useEffect(() => {
    loadQueens();
  }, []);

  const loadQueens = async () => {
    try {
      setLoading(true);
      const res = await api.get('/queens');
      setQueens(res.data.queens);
    } catch (error) {
      console.error('Failed to load queens:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/queens', formData);
      setShowForm(false);
      setFormData({
        hive_id: '',
        name: '',
        lineage: '',
        birth_date: '',
        status: 'active',
        notes: ''
      });
      loadQueens();
    } catch (error) {
      console.error('Failed to create queen:', error);
      alert('Failed to create queen record');
    }
  };

  if (loading) {
    return <div className="queen-records-loading">Loading...</div>;
  }

  return (
    <div className="queen-records">
      <div className="queen-records-header">
        <h2>Queen Records</h2>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          {showForm ? 'Cancel' : 'Add Queen'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="queen-form">
          <div className="form-group">
            <label>Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Lineage</label>
            <input
              type="text"
              value={formData.lineage}
              onChange={(e) => setFormData({ ...formData, lineage: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Birth Date</label>
            <input
              type="date"
              value={formData.birth_date}
              onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            >
              <option value="active">Active</option>
              <option value="replaced">Replaced</option>
              <option value="dead">Dead</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>
          <button type="submit" className="btn-primary">Create Queen Record</button>
        </form>
      )}

      <div className="queens-list">
        {queens.length === 0 ? (
          <p>No queen records found</p>
        ) : (
          <ul>
            {queens.map((queen) => (
              <li key={queen.id} className="queen-item">
                <div className="queen-info">
                  <h3>{queen.name || 'Unnamed Queen'}</h3>
                  {queen.hive_label && (
                    <p>Hive: <Link to={`/hives/${queen.hive_id}`}>{queen.hive_label}</Link></p>
                  )}
                  {queen.lineage && <p>Lineage: {queen.lineage}</p>}
                  {queen.birth_date && <p>Birth Date: {new Date(queen.birth_date).toLocaleDateString()}</p>}
                  <p>Status: <span className={`status-${queen.status}`}>{queen.status}</span></p>
                  {queen.notes && <p className="notes">{queen.notes}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
