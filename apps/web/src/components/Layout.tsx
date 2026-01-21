import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { startAutoSync } from '../utils/sync';
import { useEffect } from 'react';
import NFCScanner from './NFCScanner';
import ChatButton from './ChatButton';
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
        <div className="layout-header-brand">
          <img src="/logo-horizontal.png" alt="My Hive" className="layout-logo" />
        </div>
        <nav className="layout-nav">
          <Link to="/">
            <img src="/hive-icon.png" alt="" className="icon-small" />
            Dashboard
          </Link>
          <Link to="/apiaries">
            <img src="/apiary-icon.png" alt="" className="icon-small" />
            Apiaries
          </Link>
          <Link to="/map">
            <img src="/map-icon.png" alt="" className="icon-small" />
            Map
          </Link>
          <Link to="/queens">
            <img src="/queen-icon.png" alt="" className="icon-small" />
            Queens
          </Link>
          <Link to="/shop">
            <img src="/resources-icon.png" alt="" className="icon-small" />
            Shop
          </Link>
          <Link to="/honey">
            <img src="/bee-icon.png" alt="" className="icon-small" />
            Honey
          </Link>
          <Link to="/pests">
            <img src="/inspection-icon.png" alt="" className="icon-small" />
            Pests
          </Link>
          <Link to="/maintenance">
            <img src="/weather-icon.png" alt="" className="icon-small" />
            Maintenance
          </Link>
          {user?.role === 'admin' && (
            <Link to="/admin">
              <img src="/profile-icon.png" alt="" className="icon-small" />
              Admin
            </Link>
          )}
          <NFCScanner />
          <button onClick={handleLogout} className="btn-link">
            <img src="/profile-icon.png" alt="" className="icon-small" />
            {user?.name}
          </button>
        </nav>
      </header>
      <main className="layout-main">
        <Outlet />
      </main>
      {user && <ChatButton />}
    </div>
  );
}
