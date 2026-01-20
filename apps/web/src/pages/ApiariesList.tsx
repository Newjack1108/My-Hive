import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';
import './ApiariesList.css';

interface Apiary {
  id: string;
  name: string;
  description?: string;
  lat?: number;
  lng?: number;
}

interface Hive {
  id: string;
  public_id: string;
  label: string;
  apiary_id?: string;
}

export default function ApiariesList() {
  const [apiaries, setApiaries] = useState<Apiary[]>([]);
  const [hives, setHives] = useState<Hive[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [apiariesRes, hivesRes] = await Promise.all([
        api.get('/apiaries'),
        api.get('/hives'),
      ]);

      setApiaries(apiariesRes.data.apiaries);
      setHives(hivesRes.data.hives);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="apiaries-loading">Loading...</div>;
  }

  return (
    <div className="apiaries-list">
      <div className="page-header">
        <img src="/apiary-icon.png" alt="" className="page-icon" />
        <h2>Apiaries</h2>
      </div>

      {apiaries.length === 0 ? (
        <p className="empty-state">No apiaries yet</p>
      ) : (
        <div className="apiaries-grid">
          {apiaries.map((apiary) => {
            const apiaryHives = hives.filter((h) => h.apiary_id === apiary.id);
            return (
              <div key={apiary.id} className="apiary-card">
                <h3>{apiary.name}</h3>
                {apiary.description && <p className="apiary-description">{apiary.description}</p>}
                {apiary.lat && apiary.lng && (
                  <p className="apiary-location">
                    <img src="/map-icon.png" alt="" className="icon-inline" />
                    {Number(apiary.lat).toFixed(4)}, {Number(apiary.lng).toFixed(4)}
                  </p>
                )}
                <div className="apiary-stats">
                  <span>{apiaryHives.length} hive(s)</span>
                </div>
                <div className="apiary-hives">
                  {apiaryHives.map((hive) => (
                    <Link
                      key={hive.id}
                      to={`/hives/${hive.id}`}
                      className="hive-link"
                    >
                      <img src="/bee-icon.png" alt="" className="icon-inline" />
                      {hive.label} ({hive.public_id})
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="all-hives-section">
        <h3>All Hives</h3>
        {hives.length === 0 ? (
          <p className="empty-state">No hives yet</p>
        ) : (
          <div className="hives-list">
            {hives.map((hive) => (
              <Link key={hive.id} to={`/hives/${hive.id}`} className="hive-item">
                <img src="/bee-icon.png" alt="" className="hive-item-icon" />
                <div className="hive-item-label">{hive.label}</div>
                <div className="hive-item-id">{hive.public_id}</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
