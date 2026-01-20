import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { startAutoSync } from '../utils/sync';
import { useEffect } from 'react';
import './Layout.css';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Start auto-sync when layout mounts
    startAutoSync();
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      <header className="layout-header">
        <h1>🐝 My Hive</h1>
        <nav className="layout-nav">
          <Link to="/">Dashboard</Link>
          <Link to="/apiaries">Apiaries</Link>
          {user?.role === 'admin' && <Link to="/admin">Admin</Link>}
          <button onClick={handleLogout} className="btn-link">
            Logout ({user?.name})
          </button>
        </nav>
      </header>
      <main className="layout-main">
        <Outlet />
      </main>
    </div>
  );
}
