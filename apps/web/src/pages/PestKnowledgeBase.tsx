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
}

export default function PestKnowledgeBase() {
  const [pests, setPests] = useState<Pest[]>([]);
  const [selectedPest, setSelectedPest] = useState<Pest | null>(null);
  const [treatments, setTreatments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadPests();
  }, []);

  useEffect(() => {
    if (selectedPest) {
      loadPestDetails();
    }
  }, [selectedPest]);

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

  if (loading) {
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

      <div className="pest-content">
        <div className="pests-list">
          <h3>Pests ({pests.length})</h3>
          {pests.length === 0 ? (
            <p>No pests found</p>
          ) : (
            <ul>
              {pests.map((pest) => (
                <li
                  key={pest.id}
                  className={`pest-item ${selectedPest?.id === pest.id ? 'active' : ''}`}
                  onClick={() => setSelectedPest(pest)}
                >
                  <h4>{pest.name}</h4>
                  {pest.scientific_name && <p className="scientific">{pest.scientific_name}</p>}
                  {pest.severity_level && (
                    <span className={`severity severity-${pest.severity_level}`}>
                      {pest.severity_level}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {selectedPest && (
          <div className="pest-detail">
            <h3>{selectedPest.name}</h3>
            {selectedPest.scientific_name && (
              <p className="scientific-name">{selectedPest.scientific_name}</p>
            )}
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
        )}
      </div>
    </div>
  );
}
