import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';
import PhotoUpload from '../components/PhotoUpload';
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

interface Hive {
  id: string;
  label: string;
  public_id: string;
}

interface Photo {
  id: string;
  url: string;
  thumbnail_url: string;
  width?: number;
  height?: number;
  created_at: string;
}

export default function QueenRecords() {
  const [queens, setQueens] = useState<Queen[]>([]);
  const [hives, setHives] = useState<Hive[]>([]);
  const [queenPhotos, setQueenPhotos] = useState<Record<string, Photo[]>>({});
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
    loadHives();
  }, []);

  const loadQueens = async () => {
    try {
      setLoading(true);
      const res = await api.get('/queens');
      setQueens(res.data.queens);
      
      // Load photos for each queen
      const photosMap: Record<string, Photo[]> = {};
      for (const queen of res.data.queens) {
        try {
          const queenRes = await api.get(`/queens/${queen.id}`);
          if (queenRes.data.photos) {
            photosMap[queen.id] = queenRes.data.photos;
          }
        } catch (error) {
          console.error(`Failed to load photos for queen ${queen.id}:`, error);
        }
      }
      setQueenPhotos(photosMap);
    } catch (error) {
      console.error('Failed to load queens:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUploaded = async (queenId: string) => {
    try {
      const res = await api.get(`/queens/${queenId}`);
      if (res.data.photos) {
        setQueenPhotos((prev) => ({
          ...prev,
          [queenId]: res.data.photos,
        }));
      }
    } catch (error) {
      console.error('Failed to reload queen photos:', error);
    }
  };

  const loadHives = async () => {
    try {
      const res = await api.get('/hives');
      setHives(res.data.hives || []);
    } catch (error) {
      console.error('Failed to load hives:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Convert empty strings to undefined for optional fields
      const submitData: any = {
        status: formData.status || 'active',
      };
      
      if (formData.hive_id && formData.hive_id.trim() !== '') {
        submitData.hive_id = formData.hive_id;
      }
      if (formData.name && formData.name.trim() !== '') {
        submitData.name = formData.name;
      }
      if (formData.lineage && formData.lineage.trim() !== '') {
        submitData.lineage = formData.lineage;
      }
      if (formData.birth_date && formData.birth_date.trim() !== '') {
        submitData.birth_date = formData.birth_date;
      }
      if (formData.notes && formData.notes.trim() !== '') {
        submitData.notes = formData.notes;
      }
      
      await api.post('/queens', submitData);
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
    } catch (error: any) {
      console.error('Failed to create queen:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to create queen record';
      alert(errorMessage);
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
            <label>Hive (Optional)</label>
            <select
              value={formData.hive_id}
              onChange={(e) => setFormData({ ...formData, hive_id: e.target.value })}
            >
              <option value="">None (unassigned)</option>
              {hives.map((hive) => (
                <option key={hive.id} value={hive.id}>
                  {hive.label} ({hive.public_id})
                </option>
              ))}
            </select>
          </div>
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
                  <div className="queen-photos-section">
                    <PhotoUpload
                      entityType="queens"
                      entityId={queen.id}
                      photos={queenPhotos[queen.id] || []}
                      onPhotoUploaded={() => handlePhotoUploaded(queen.id)}
                    />
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
