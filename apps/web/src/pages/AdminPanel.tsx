import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import './AdminPanel.css';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
  last_login_at?: string;
}

interface Apiary {
  id: string;
  name: string;
}

interface Hive {
  id: string;
  public_id: string;
  label: string;
  apiary_id?: string;
}

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<'users' | 'apiaries' | 'hives'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [apiaries, setApiaries] = useState<Apiary[]>([]);
  const [hives, setHives] = useState<Hive[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    name: '',
    role: 'inspector' as 'admin' | 'manager' | 'inspector' | 'viewer',
    password: '',
  });

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      if (activeTab === 'users') {
        const res = await api.get('/users');
        setUsers(res.data.users);
      } else if (activeTab === 'apiaries') {
        const res = await api.get('/apiaries');
        setApiaries(res.data.apiaries);
      } else if (activeTab === 'hives') {
        const res = await api.get('/hives');
        setHives(res.data.hives);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/users', newUser);
      setShowCreateUser(false);
      setNewUser({ email: '', name: '', role: 'inspector', password: '' });
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create user');
    }
  };

  const handleUpdateUserRole = async (userId: string, role: string) => {
    try {
      await api.patch(`/users/${userId}/role`, { role });
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update role');
    }
  };

  return (
    <div className="admin-panel">
      <h2>Admin Panel</h2>

      <div className="admin-tabs">
        <button
          onClick={() => setActiveTab('users')}
          className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
        >
          Users
        </button>
        <button
          onClick={() => setActiveTab('apiaries')}
          className={`tab-btn ${activeTab === 'apiaries' ? 'active' : ''}`}
        >
          Apiaries
        </button>
        <button
          onClick={() => setActiveTab('hives')}
          className={`tab-btn ${activeTab === 'hives' ? 'active' : ''}`}
        >
          Hives
        </button>
      </div>

      {loading ? (
        <div className="admin-loading">Loading...</div>
      ) : (
        <>
          {activeTab === 'users' && (
            <div className="admin-section">
              <div className="section-header">
                <h3>Users</h3>
                <button
                  onClick={() => setShowCreateUser(true)}
                  className="btn-primary"
                >
                  + Create User
                </button>
              </div>

              {showCreateUser && (
                <div className="create-user-form">
                  <h4>Create New User</h4>
                  <form onSubmit={handleCreateUser}>
                    <div className="form-group">
                      <label>Email</label>
                      <input
                        type="email"
                        value={newUser.email}
                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Name</label>
                      <input
                        type="text"
                        value={newUser.name}
                        onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Role</label>
                      <select
                        value={newUser.role}
                        onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })}
                      >
                        <option value="viewer">Viewer</option>
                        <option value="inspector">Inspector</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Password (optional - will generate temp if not provided)</label>
                      <input
                        type="password"
                        value={newUser.password}
                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                        placeholder="Leave empty for temporary password"
                      />
                    </div>
                    <div className="form-actions">
                      <button type="submit" className="btn-primary">
                        Create User
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCreateUser(false)}
                        className="btn-secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="users-list">
                {users.map((user) => (
                  <div key={user.id} className="user-card">
                    <div className="user-info">
                      <div className="user-name">{user.name}</div>
                      <div className="user-email">{user.email}</div>
                      <div className="user-meta">
                        Role: {user.role} | Created: {new Date(user.created_at).toLocaleDateString()}
                        {user.last_login_at && (
                          <> | Last login: {new Date(user.last_login_at).toLocaleDateString()}</>
                        )}
                      </div>
                    </div>
                    <div className="user-actions">
                      <select
                        value={user.role}
                        onChange={(e) => handleUpdateUserRole(user.id, e.target.value)}
                        className="role-select"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="inspector">Inspector</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'apiaries' && (
            <div className="admin-section">
              <h3>Apiaries ({apiaries.length})</h3>
              <div className="apiaries-list">
                {apiaries.map((apiary) => (
                  <div key={apiary.id} className="apiary-item">
                    {apiary.name}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'hives' && (
            <div className="admin-section">
              <h3>Hives ({hives.length})</h3>
              <div className="hives-list">
                {hives.map((hive) => (
                  <div key={hive.id} className="hive-item">
                    <div className="hive-label">
                      <img src="/hive-icon.png" alt="" className="icon-inline" />
                      {hive.label}
                    </div>
                    <div className="hive-id">ID: {hive.public_id}</div>
                    <div className="hive-url">
                      URL: /h/{hive.public_id}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
