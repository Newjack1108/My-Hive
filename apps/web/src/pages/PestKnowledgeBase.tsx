import { useEffect, useState } from 'react';
import { api } from '../utils/api';
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
}

export default function PestKnowledgeBase() {
  const [pests, setPests] = useState<Pest[]>([]);
  const [selectedPest, setSelectedPest] = useState<Pest | null>(null);
  const [treatments, setTreatments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    loadPests();
  }, []);

  useEffect(() => {
    if (search !== '') {
      const timeoutId = setTimeout(() => {
        loadPests();
      }, 300);
      return () => clearTimeout(timeoutId);
    } else {
      loadPests();
    }
  }, [search]);

  useEffect(() => {
    if (selectedPest && isModalOpen) {
      loadPestDetails();
    }
  }, [selectedPest, isModalOpen]);

  const loadPests = async () => {
    try {
      setLoading(true);
      const res = await api.get('/pests', { params: search ? { search } : {} });
      setPests(res.data.pests);
    } catch (error) {
      console.error('Failed to load pests:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const truncateDescription = (text: string | undefined, maxLength: number = 120): string => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  };

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        closeModal();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isModalOpen]);

  if (loading && pests.length === 0) {
    return <div className="pest-loading">Loading...</div>;
  }

  return (
    <div className="pest-knowledge-base">
      <h2>Pest Knowledge Base</h2>

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
    </div>
  );
}
