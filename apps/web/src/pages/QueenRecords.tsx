import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';
import PhotoUpload from '../components/PhotoUpload';
import GraftingSessionCard from '../components/GraftingSessionCard';
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

interface GraftingSession {
  id: string;
  name: string;
  grafting_date: string;
  method: 'standard' | 'starter_finisher' | 'cell_builder';
  status: 'active' | 'completed' | 'cancelled';
  checklist_completed: Record<string, boolean>;
  queen_id?: string;
  hive_id?: string;
  queen_name?: string;
  hive_label?: string;
  notes?: string;
}

export default function QueenRecords() {
  const [queens, setQueens] = useState<Queen[]>([]);
  const [hives, setHives] = useState<Hive[]>([]);
  const [queenPhotos, setQueenPhotos] = useState<Record<string, Photo[]>>({});
  const [graftingSessions, setGraftingSessions] = useState<GraftingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showGraftingForm, setShowGraftingForm] = useState(false);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    hive_id: '',
    name: '',
    lineage: '',
    birth_date: '',
    status: 'active',
    notes: ''
  });
  const [graftingFormData, setGraftingFormData] = useState({
    queen_id: '',
    hive_id: '',
    name: '',
    grafting_date: new Date().toISOString().split('T')[0],
    method: 'standard' as 'standard' | 'starter_finisher' | 'cell_builder',
    notes: ''
  });

  useEffect(() => {
    loadQueens();
    loadHives();
    loadGraftingSessions();
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

  const loadGraftingSessions = async () => {
    try {
      const res = await api.get('/queens/grafting-sessions');
      setGraftingSessions(res.data.sessions || []);
    } catch (error) {
      console.error('Failed to load grafting sessions:', error);
    }
  };

  const handleCreateGraftingSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/queens/grafting-sessions', graftingFormData);
      setShowGraftingForm(false);
      setGraftingFormData({
        queen_id: '',
        hive_id: '',
        name: '',
        grafting_date: new Date().toISOString().split('T')[0],
        method: 'standard',
        notes: ''
      });
      loadGraftingSessions();
    } catch (error: any) {
      console.error('Failed to create grafting session:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to create grafting session';
      alert(errorMessage);
    }
  };

  const handleToggleChecklist = async (sessionId: string, milestoneKey: string, completed: boolean) => {
    try {
      const session = graftingSessions.find(s => s.id === sessionId);
      if (!session) return;

      const updatedChecklist = {
        ...session.checklist_completed,
        [milestoneKey]: completed
      };

      await api.patch(`/queens/grafting-sessions/${sessionId}`, {
        checklist_completed: updatedChecklist
      });

      setGraftingSessions(prev => prev.map(s => 
        s.id === sessionId 
          ? { ...s, checklist_completed: updatedChecklist }
          : s
      ));
    } catch (error) {
      console.error('Failed to update checklist:', error);
      alert('Failed to update checklist item');
    }
  };

  const handleUpdateStatus = async (sessionId: string, status: 'active' | 'completed' | 'cancelled') => {
    try {
      await api.patch(`/queens/grafting-sessions/${sessionId}`, { status });
      loadGraftingSessions();
    } catch (error) {
      console.error('Failed to update session status:', error);
      alert('Failed to update session status');
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await api.delete(`/queens/grafting-sessions/${sessionId}`);
      loadGraftingSessions();
    } catch (error) {
      console.error('Failed to delete session:', error);
      alert('Failed to delete session');
    }
  };

  const toggleSessionExpand = (sessionId: string) => {
    setExpandedSessions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sessionId)) {
        newSet.delete(sessionId);
      } else {
        newSet.add(sessionId);
      }
      return newSet;
    });
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
        <div className="header-actions">
          <button onClick={() => setShowGraftingForm(!showGraftingForm)} className="btn-primary">
            {showGraftingForm ? 'Cancel' : 'New Grafting Session'}
          </button>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary">
            {showForm ? 'Cancel' : 'Add Queen'}
          </button>
        </div>
      </div>

      {/* Grafting Sessions Section */}
      <div className="grafting-sessions-section">
        <h3>Grafting Sessions</h3>
        
        {showGraftingForm && (
          <form onSubmit={handleCreateGraftingSession} className="queen-form">
            <div className="form-group">
              <label>Session Name *</label>
              <input
                type="text"
                value={graftingFormData.name}
                onChange={(e) => setGraftingFormData({ ...graftingFormData, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Grafting Date *</label>
              <input
                type="date"
                value={graftingFormData.grafting_date}
                onChange={(e) => setGraftingFormData({ ...graftingFormData, grafting_date: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Method</label>
              <select
                value={graftingFormData.method}
                onChange={(e) => setGraftingFormData({ ...graftingFormData, method: e.target.value as any })}
              >
                <option value="standard">Standard</option>
                <option value="starter_finisher">Starter/Finisher</option>
                <option value="cell_builder">Cell Builder</option>
              </select>
            </div>
            <div className="form-group">
              <label>Queen (Optional)</label>
              <select
                value={graftingFormData.queen_id}
                onChange={(e) => setGraftingFormData({ ...graftingFormData, queen_id: e.target.value })}
              >
                <option value="">None</option>
                {queens.map((queen) => (
                  <option key={queen.id} value={queen.id}>
                    {queen.name || 'Unnamed Queen'}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Hive (Optional)</label>
              <select
                value={graftingFormData.hive_id}
                onChange={(e) => setGraftingFormData({ ...graftingFormData, hive_id: e.target.value })}
              >
                <option value="">None</option>
                {hives.map((hive) => (
                  <option key={hive.id} value={hive.id}>
                    {hive.label} ({hive.public_id})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea
                value={graftingFormData.notes}
                onChange={(e) => setGraftingFormData({ ...graftingFormData, notes: e.target.value })}
                rows={3}
              />
            </div>
            <button type="submit" className="btn-primary">Create Grafting Session</button>
          </form>
        )}

        {graftingSessions.length === 0 ? (
          <p className="no-sessions">No grafting sessions found. Create one to get started!</p>
        ) : (
          <div className="grafting-sessions-list">
            {graftingSessions.map((session) => (
              <GraftingSessionCard
                key={session.id}
                session={session}
                onToggleChecklist={handleToggleChecklist}
                onUpdateStatus={handleUpdateStatus}
                onDelete={handleDeleteSession}
                expanded={expandedSessions.has(session.id)}
                onToggleExpand={() => toggleSessionExpand(session.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Queen Records Section */}
      <div className="queen-records-section">
        <h3>Queen Records</h3>

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
    </div>
  );
}
