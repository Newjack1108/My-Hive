import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import './HivePublic.css';

export default function HivePublic() {
  const { publicId } = useParams<{ publicId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [requiresAuth, setRequiresAuth] = useState(false);

  useEffect(() => {
    if (!publicId) return;

    loadHive();
  }, [publicId, user]);

  const loadHive = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/hives/public/${publicId}`);
      
      if (res.data.requiresAuth) {
        setRequiresAuth(true);
        return;
      }

      // Hive loaded successfully, redirect to hive detail
      navigate(`/hives/${res.data.hive.id}`);
    } catch (error: any) {
      if (error.response?.status === 401 || error.response?.status === 404) {
        setRequiresAuth(true);
      } else {
        console.error('Failed to load hive:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="hive-public-container">
        <div className="hive-public-card">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (requiresAuth) {
    return (
      <div className="hive-public-container">
        <div className="hive-public-card">
          <h1>🐝 Private Hive</h1>
          <p>This hive is private. Please log in to access it.</p>
          {!user && (
            <button
              onClick={() => navigate('/login')}
              className="btn-primary btn-large"
            >
              Login
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
}
