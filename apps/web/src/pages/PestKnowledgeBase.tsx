import { useEffect, useState, useCallback } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import './PestKnowledgeBase.css';

interface Pest {
  id: string;
  name: string;
  scientific_name?: string;
  description?: string;
  symptoms?: string;
  severity_level?: string;
  image_url?: string;
  prevention_methods?: string;
  treatment_options?: any;
  is_global?: boolean;
  org_id?: string;
}

export default function PestKnowledgeBase() {
  const { user } = useAuth();
  const [pests, setPests] = useState<Pest[]>([]);
  const [selectedPest, setSelectedPest] = useState<Pest | null>(null);
  const [treatments, setTreatments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [pestToDelete, setPestToDelete] = useState<Pest | null>(null);
  const [editingPest, setEditingPest] = useState<Pest | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    scientific_name: '',
    description: '',
    symptoms: '',
    prevention_methods: '',
    severity_level: '' as 'low' | 'moderate' | 'high' | 'critical' | '',
    image_url: '',
    is_global: false,
  });
  const [saving, setSaving] = useState(false);

  const loadPests = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/pests', { params: search ? { search } : {} });
      setPests(res.data.pests || []);
      console.log('Pests loaded:', res.data.pests?.length || 0, 'pests');
    } catch (error) {
      console.error('Failed to load pests:', error);
    } finally {
      setLoading(false);
    }
  }, [search]);

  // Load pests on mount and when search changes (with debounce)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadPests();
    }, search ? 300 : 0); // No delay on initial load, 300ms delay for search
    return () => clearTimeout(timeoutId);
  }, [search, loadPests]);

  useEffect(() => {
    if (selectedPest && isModalOpen) {
      loadPestDetails();
    }
  }, [selectedPest, isModalOpen]);

  const loadPestDetails = async () => {
    if (!selectedPest) return;
    try {
      const res = await api.get(`/pests/${selectedPest.id}`);
      setSelectedPest(res.data.pest);
      setTreatments(res.data.treatments || []);
    } catch (error) {
      console.error('Failed to load pest details:', error);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadPests();
  };

  const openPestDetail = (pest: Pest) => {
    setSelectedPest(pest);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedPest(null);
    setTreatments([]);
  };

  const canEditPest = (pest: Pest): boolean => {
    if (!user || !['admin', 'manager'].includes(user.role)) return false;
    if (pest.is_global) return user.role === 'admin';
    return true; // Managers can edit org-specific pests
  };

  const canDeletePest = (pest: Pest): boolean => {
    if (!user || !['admin', 'manager'].includes(user.role)) return false;
    if (pest.is_global) return user.role === 'admin';
    return true; // Managers can delete org-specific pests
  };

  const handleEditClick = (e: React.MouseEvent, pest: Pest) => {
    e.stopPropagation(); // Prevent opening detail modal
    setEditingPest(pest);
    setFormData({
      name: pest.name,
      scientific_name: pest.scientific_name || '',
      description: pest.description || '',
      symptoms: pest.symptoms || '',
      prevention_methods: pest.prevention_methods || '',
      severity_level: (pest.severity_level as any) || '',
      image_url: pest.image_url || '',
      is_global: pest.is_global || false,
    });
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = (e: React.MouseEvent, pest: Pest) => {
    e.stopPropagation(); // Prevent opening detail modal
    setPestToDelete(pest);
    setIsDeleteConfirmOpen(true);
  };

  const handleCreateClick = () => {
    setEditingPest(null);
    setFormData({
      name: '',
      scientific_name: '',
      description: '',
      symptoms: '',
      prevention_methods: '',
      severity_level: '',
      image_url: '',
      is_global: false,
    });
    setIsCreateModalOpen(true);
  };

  const handleSavePest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Pest name is required');
      return;
    }

    setSaving(true);
    try {
      if (editingPest) {
        // Update existing pest - exclude is_global (can't change it after creation)
        const { is_global, ...updateData } = formData;
        await api.patch(`/pests/${editingPest.id}`, updateData);
      } else {
        // Create new pest
        await api.post('/pests', formData);
      }
      setIsEditModalOpen(false);
      setIsCreateModalOpen(false);
      setEditingPest(null);
      loadPests(); // Refresh the list
    } catch (error: any) {
      console.error('Failed to save pest:', error);
      alert(error.response?.data?.error || 'Failed to save pest');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePest = async () => {
    if (!pestToDelete) return;

    setSaving(true);
    try {
      await api.delete(`/pests/${pestToDelete.id}`);
      setIsDeleteConfirmOpen(false);
      setPestToDelete(null);
      loadPests(); // Refresh the list
    } catch (error: any) {
      console.error('Failed to delete pest:', error);
      alert(error.response?.data?.error || 'Failed to delete pest');
    } finally {
      setSaving(false);
    }
  };

  const truncateDescription = (text: string | undefined, maxLength: number = 120): string => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  };

  // Handle ESC key to close modals
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isModalOpen) {
          closeModal();
        }
        if (isEditModalOpen) {
          setIsEditModalOpen(false);
          setEditingPest(null);
        }
        if (isCreateModalOpen) {
          setIsCreateModalOpen(false);
        }
        if (isDeleteConfirmOpen) {
          setIsDeleteConfirmOpen(false);
          setPestToDelete(null);
        }
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isModalOpen, isEditModalOpen, isCreateModalOpen, isDeleteConfirmOpen]);

  // Debug logging
  useEffect(() => {
    console.log('PestKnowledgeBase render - pests:', pests.length, 'loading:', loading);
    console.log('Using card layout:', pests.length > 0 ? 'Yes' : 'No pests to display');
  }, [pests.length, loading]);

  if (loading && pests.length === 0) {
    return <div className="pest-loading">Loading...</div>;
  }

  const isAdminOrManager = user && ['admin', 'manager'].includes(user.role);

  return (
    <div className="pest-knowledge-base">
      <div className="pest-header">
        <h2>Pest Knowledge Base</h2>
        {isAdminOrManager && (
          <button onClick={handleCreateClick} className="btn-primary">
            + Add New Pest
          </button>
        )}
      </div>

      <form onSubmit={handleSearch} className="search-form">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search pests by name or symptoms..."
          className="search-input"
        />
        <button type="submit" className="btn-primary">Search</button>
      </form>

      <div className="pest-cards-container">
        <div className="pest-cards-header">
          <h3>Pests ({pests.length})</h3>
        </div>
        {pests.length === 0 ? (
          <p className="no-pests">No pests found</p>
        ) : (
          <div className="pest-cards-grid">
            {pests.map((pest) => (
              <div
                key={pest.id}
                className="pest-card"
                onClick={() => openPestDetail(pest)}
              >
                {isAdminOrManager && (
                  <div className="pest-card-actions" onClick={(e) => e.stopPropagation()}>
                    {canEditPest(pest) && (
                      <button
                        className="pest-card-edit"
                        onClick={(e) => handleEditClick(e, pest)}
                        title="Edit pest"
                        aria-label="Edit pest"
                      >
                        ✏️
                      </button>
                    )}
                    {canDeletePest(pest) && (
                      <button
                        className="pest-card-delete"
                        onClick={(e) => handleDeleteClick(e, pest)}
                        title="Delete pest"
                        aria-label="Delete pest"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                )}
                <div className="pest-card-image">
                  <img
                    src={pest.image_url || '/bee-icon.png'}
                    alt={pest.name}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/bee-icon.png';
                    }}
                  />
                </div>
                <div className="pest-card-content">
                  <h3 className="pest-card-name">{pest.name}</h3>
                  {pest.scientific_name && (
                    <p className="pest-card-scientific">{pest.scientific_name}</p>
                  )}
                  <p className="pest-card-description">
                    {truncateDescription(pest.description)}
                  </p>
                  {pest.severity_level && (
                    <span className={`severity severity-${pest.severity_level}`}>
                      {pest.severity_level}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && selectedPest && (
        <div className="pest-modal-overlay" onClick={closeModal}>
          <div className="pest-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="pest-modal-close" onClick={closeModal} aria-label="Close">
              ×
            </button>
            <div className="pest-article">
              <div className="pest-article-header">
                <div className="pest-article-image">
                  <img
                    src={selectedPest.image_url || '/bee-icon.png'}
                    alt={selectedPest.name}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/bee-icon.png';
                    }}
                  />
                </div>
                <div className="pest-article-title">
                  <h2>{selectedPest.name}</h2>
                  {selectedPest.scientific_name && (
                    <p className="scientific-name">{selectedPest.scientific_name}</p>
                  )}
                  {selectedPest.severity_level && (
                    <span className={`severity severity-${selectedPest.severity_level}`}>
                      {selectedPest.severity_level}
                    </span>
                  )}
                </div>
              </div>

              {selectedPest.description && (
                <div className="detail-section">
                  <h4>Description</h4>
                  <p>{selectedPest.description}</p>
                </div>
              )}

              {selectedPest.symptoms && (
                <div className="detail-section">
                  <h4>Symptoms</h4>
                  <p>{selectedPest.symptoms}</p>
                </div>
              )}

              {selectedPest.prevention_methods && (
                <div className="detail-section">
                  <h4>Prevention Methods</h4>
                  <p>{selectedPest.prevention_methods}</p>
                </div>
              )}

              {treatments.length > 0 && (
                <div className="detail-section">
                  <h4>Treatments</h4>
                  <ul>
                    {treatments.map((treatment) => (
                      <li key={treatment.id}>
                        <strong>{treatment.treatment_name}</strong>
                        {treatment.treatment_method && <p>{treatment.treatment_method}</p>}
                        {treatment.effectiveness_rating && (
                          <p>Effectiveness: {treatment.effectiveness_rating}/5</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit/Create Pest Modal */}
      {(isEditModalOpen || isCreateModalOpen) && (
        <div className="pest-modal-overlay" onClick={() => {
          setIsEditModalOpen(false);
          setIsCreateModalOpen(false);
          setEditingPest(null);
        }}>
          <div className="pest-modal-content pest-form-modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="pest-modal-close"
              onClick={() => {
                setIsEditModalOpen(false);
                setIsCreateModalOpen(false);
                setEditingPest(null);
              }}
              aria-label="Close"
            >
              ×
            </button>
            <div className="pest-form">
              <h2>{editingPest ? 'Edit Pest' : 'Add New Pest'}</h2>
              <form onSubmit={handleSavePest}>
                <div className="form-group">
                  <label>Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>Scientific Name</label>
                  <input
                    type="text"
                    value={formData.scientific_name}
                    onChange={(e) => setFormData({ ...formData, scientific_name: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                    className="form-textarea"
                  />
                </div>
                <div className="form-group">
                  <label>Symptoms</label>
                  <textarea
                    value={formData.symptoms}
                    onChange={(e) => setFormData({ ...formData, symptoms: e.target.value })}
                    rows={3}
                    className="form-textarea"
                  />
                </div>
                <div className="form-group">
                  <label>Prevention Methods</label>
                  <textarea
                    value={formData.prevention_methods}
                    onChange={(e) => setFormData({ ...formData, prevention_methods: e.target.value })}
                    rows={3}
                    className="form-textarea"
                  />
                </div>
                <div className="form-group">
                  <label>Severity Level</label>
                  <select
                    value={formData.severity_level}
                    onChange={(e) => setFormData({ ...formData, severity_level: e.target.value as any })}
                    className="form-select"
                  >
                    <option value="">Select severity...</option>
                    <option value="low">Low</option>
                    <option value="moderate">Moderate</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Image URL</label>
                  <input
                    type="url"
                    value={formData.image_url}
                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                    placeholder="https://example.com/image.jpg"
                    className="form-input"
                  />
                </div>
                {user?.role === 'admin' && !editingPest && (
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.is_global}
                        onChange={(e) => setFormData({ ...formData, is_global: e.target.checked })}
                      />
                      <span>Make this pest global (available to all organizations)</span>
                    </label>
                  </div>
                )}
                <div className="form-actions">
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {saving ? 'Saving...' : editingPest ? 'Save Changes' : 'Create Pest'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditModalOpen(false);
                      setIsCreateModalOpen(false);
                      setEditingPest(null);
                    }}
                    className="btn-secondary"
                    disabled={saving}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteConfirmOpen && pestToDelete && (
        <div className="pest-modal-overlay" onClick={() => {
          setIsDeleteConfirmOpen(false);
          setPestToDelete(null);
        }}>
          <div className="pest-modal-content pest-delete-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Delete Pest</h2>
            <p>Are you sure you want to delete <strong>{pestToDelete.name}</strong>?</p>
            <p className="delete-warning">This action cannot be undone.</p>
            <div className="form-actions">
              <button
                onClick={handleDeletePest}
                className="btn-danger"
                disabled={saving}
              >
                {saving ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => {
                  setIsDeleteConfirmOpen(false);
                  setPestToDelete(null);
                }}
                className="btn-secondary"
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
