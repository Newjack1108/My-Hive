import { useEffect, useState } from 'react';
import { Device } from '@my-hive/shared';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import ProductImageUpload from '../components/ProductImageUpload';
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

interface Category {
  id: string;
  name: string;
  description?: string;
}

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  stock_quantity: number;
  sku?: string;
  image_url?: string | null;
  category_id?: string | null;
  category_name?: string;
  active: boolean;
}

interface DiscoveredDevice {
  device_id: string;
  last_seen_at?: string;
  device_name?: string;
}

export default function AdminPanel() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'apiaries' | 'hives' | 'shop' | 'devices'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [apiaries, setApiaries] = useState<Apiary[]>([]);
  const [hives, setHives] = useState<Hive[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredDevice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    name: '',
    role: 'inspector' as 'admin' | 'manager' | 'inspector' | 'viewer',
    password: '',
  });
  const [showCreateProduct, setShowCreateProduct] = useState(false);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    price: '',
    stock_quantity: '0',
    category_id: '',
    sku: '',
  });
  const [newCategory, setNewCategory] = useState({
    name: '',
    description: '',
  });
  const [editProduct, setEditProduct] = useState({
    name: '',
    description: '',
    price: '',
    stock_quantity: '',
    category_id: '',
    sku: '',
  });
  const [shopError, setShopError] = useState<string | null>(null);
  const [devicesError, setDevicesError] = useState<string | null>(null);
  const [showCreateDevice, setShowCreateDevice] = useState(false);
  const [newDevice, setNewDevice] = useState({
    device_id: '',
    device_name: '',
    hive_id: '',
  });
  const [deviceEdits, setDeviceEdits] = useState<Record<string, { device_name: string; hive_id: string }>>({});

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      setShopError(null);
      setDevicesError(null);
      if (activeTab === 'users') {
        const res = await api.get('/users');
        setUsers(res.data.users);
      } else if (activeTab === 'apiaries') {
        const res = await api.get('/apiaries');
        setApiaries(res.data.apiaries);
      } else if (activeTab === 'hives') {
        const res = await api.get('/hives');
        setHives(res.data.hives);
      } else if (activeTab === 'shop') {
        const [productsRes, categoriesRes] = await Promise.all([
          api.get('/shop/products', { params: { active: 'false' } }),
          api.get('/shop/categories'),
        ]);
        setProducts(productsRes.data.products);
        setCategories(categoriesRes.data.categories);
      } else if (activeTab === 'devices') {
        const [devicesRes, discoveredRes, hivesRes] = await Promise.all([
          api.get('/devices'),
          api.get('/devices/discovered'),
          api.get('/hives'),
        ]);
        const loadedDevices: Device[] = devicesRes.data.devices;
        setDevices(loadedDevices);
        setDiscoveredDevices(discoveredRes.data.discovered || []);
        setHives(hivesRes.data.hives);
        const edits: Record<string, { device_name: string; hive_id: string }> = {};
        loadedDevices.forEach((d) => {
          edits[d.id] = {
            device_name: d.device_name || '',
            hive_id: d.hive_id || '',
          };
        });
        setDeviceEdits(edits);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      if (activeTab === 'shop') setShopError('Failed to load shop data');
      if (activeTab === 'devices') setDevicesError('Failed to load devices');
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

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setShopError(null);
    try {
      await api.post('/shop/categories', {
        name: newCategory.name,
        description: newCategory.description || undefined,
      });
      setShowCreateCategory(false);
      setNewCategory({ name: '', description: '' });
      loadData();
    } catch (error: any) {
      setShopError(error.response?.data?.error || 'Failed to create category');
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setShopError(null);
    try {
      await api.post('/shop/products', {
        name: newProduct.name,
        description: newProduct.description || undefined,
        price: parseFloat(newProduct.price) || 0,
        stock_quantity: parseInt(newProduct.stock_quantity, 10) || 0,
        category_id: newProduct.category_id || undefined,
        sku: newProduct.sku || undefined,
      });
      setShowCreateProduct(false);
      setNewProduct({ name: '', description: '', price: '', stock_quantity: '0', category_id: '', sku: '' });
      loadData();
    } catch (err: any) {
      setShopError(err.response?.data?.error || 'Failed to create product');
    }
  };

  const startEditProduct = (p: Product) => {
    setEditingProduct(p);
    setEditProduct({
      name: p.name,
      description: p.description || '',
      price: String(p.price),
      stock_quantity: String(p.stock_quantity),
      category_id: p.category_id || '',
      sku: p.sku || '',
    });
    setShopError(null);
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setShopError(null);
    try {
      await api.patch(`/shop/products/${editingProduct.id}`, {
        name: editProduct.name,
        description: editProduct.description || undefined,
        price: parseFloat(editProduct.price) || 0,
        stock_quantity: parseInt(editProduct.stock_quantity, 10) || 0,
        category_id: editProduct.category_id || undefined,
        sku: editProduct.sku || undefined,
      });
      setEditingProduct(null);
      loadData();
    } catch (err: any) {
      setShopError(err.response?.data?.error || 'Failed to update product');
    }
  };

  const handleDeleteProduct = async (p: Product) => {
    if (!confirm(`Delete "${p.name}"?`)) return;
    setShopError(null);
    try {
      await api.delete(`/shop/products/${p.id}`);
      if (editingProduct?.id === p.id) setEditingProduct(null);
      loadData();
    } catch (err: any) {
      setShopError(err.response?.data?.error || 'Failed to delete product');
    }
  };

  const refreshEditedProduct = async () => {
    if (!editingProduct) return;
    try {
      const res = await api.get(`/shop/products/${editingProduct.id}`);
      setEditingProduct(res.data.product);
    } catch {
      loadData();
    }
  };

  const handleCreateDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setDevicesError(null);
    try {
      await api.post('/devices', {
        device_id: newDevice.device_id.trim(),
        device_name: newDevice.device_name.trim() || undefined,
        hive_id: newDevice.hive_id || null,
      });
      setShowCreateDevice(false);
      setNewDevice({ device_id: '', device_name: '', hive_id: '' });
      loadData();
    } catch (err: any) {
      setDevicesError(err.response?.data?.error || 'Failed to register device');
    }
  };

  const handleSaveDevice = async (device: Device) => {
    const edit = deviceEdits[device.id];
    if (!edit) return;
    setDevicesError(null);
    try {
      await api.patch(`/devices/${device.id}`, {
        device_name: edit.device_name.trim() || null,
        hive_id: edit.hive_id || null,
      });
      loadData();
    } catch (err: any) {
      setDevicesError(err.response?.data?.error || 'Failed to update device');
    }
  };

  const handleDeleteDevice = async (device: Device) => {
    if (!confirm(`Remove device "${device.device_id}" from My Hive?`)) return;
    setDevicesError(null);
    try {
      await api.delete(`/devices/${device.id}`);
      loadData();
    } catch (err: any) {
      setDevicesError(err.response?.data?.error || 'Failed to delete device');
    }
  };

  const updateDeviceEdit = (id: string, field: 'device_name' | 'hive_id', value: string) => {
    setDeviceEdits((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  return (
    <div className="admin-panel">
      <div className="page-header">
        <img src="/profile-icon.png" alt="" className="page-icon" />
        <h2>Admin Panel</h2>
      </div>

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
        <button
          onClick={() => setActiveTab('shop')}
          className={`tab-btn ${activeTab === 'shop' ? 'active' : ''}`}
        >
          Shop
        </button>
        <button
          onClick={() => setActiveTab('devices')}
          className={`tab-btn ${activeTab === 'devices' ? 'active' : ''}`}
        >
          Devices
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

          {activeTab === 'devices' && (
            <div className="admin-section">
              {user?.role !== 'admin' ? (
                <p>Access denied. Admin role required.</p>
              ) : (
                <>
                  <div className="section-header">
                    <h3>IoT Devices ({devices.length})</h3>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateDevice(true);
                        setDevicesError(null);
                      }}
                      className="btn-primary"
                    >
                      + Register Device
                    </button>
                  </div>

                  {devicesError && <div className="admin-devices-error">{devicesError}</div>}

                  {showCreateDevice && (
                    <div className="create-user-form admin-device-form">
                      <h4>Register IoT Device</h4>
                      <form onSubmit={handleCreateDevice}>
                        <div className="form-group">
                          <label>Device ID</label>
                          {discoveredDevices.length > 0 ? (
                            <select
                              value={newDevice.device_id}
                              onChange={(e) => {
                                const selected = discoveredDevices.find((d) => d.device_id === e.target.value);
                                setNewDevice({
                                  ...newDevice,
                                  device_id: e.target.value,
                                  device_name: selected?.device_name || newDevice.device_name,
                                });
                              }}
                              required
                            >
                              <option value="">Select discovered device...</option>
                              {discoveredDevices.map((d) => (
                                <option key={d.device_id} value={d.device_id}>
                                  {d.device_id}
                                  {d.last_seen_at ? ` (seen ${new Date(d.last_seen_at).toLocaleString()})` : ''}
                                </option>
                              ))}
                            </select>
                          ) : null}
                          <input
                            type="text"
                            value={newDevice.device_id}
                            onChange={(e) => setNewDevice({ ...newDevice, device_id: e.target.value })}
                            placeholder="e.g. pi-001"
                            required
                            style={{ marginTop: discoveredDevices.length > 0 ? '0.5rem' : undefined }}
                          />
                        </div>
                        <div className="form-group">
                          <label>Display name (optional)</label>
                          <input
                            type="text"
                            value={newDevice.device_name}
                            onChange={(e) => setNewDevice({ ...newDevice, device_name: e.target.value })}
                            placeholder="Hive 1 Entrance Node"
                          />
                        </div>
                        <div className="form-group">
                          <label>Assign to hive (optional)</label>
                          <select
                            value={newDevice.hive_id}
                            onChange={(e) => setNewDevice({ ...newDevice, hive_id: e.target.value })}
                          >
                            <option value="">Unassigned</option>
                            {hives.map((hive) => (
                              <option key={hive.id} value={hive.id}>{hive.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="form-actions">
                          <button type="submit" className="btn-primary">Register</button>
                          <button type="button" className="btn-secondary" onClick={() => setShowCreateDevice(false)}>
                            Cancel
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  <div className="admin-devices-table-wrap">
                    <table className="admin-devices-table">
                      <thead>
                        <tr>
                          <th>Device ID</th>
                          <th>Name</th>
                          <th>Hive</th>
                          <th>Last seen</th>
                          <th>Temp</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {devices.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="admin-devices-empty">
                              No devices registered. Heartbeats from your Pi will appear under discovered devices when registering.
                            </td>
                          </tr>
                        ) : (
                          devices.map((device) => (
                            <tr key={device.id}>
                              <td><code>{device.device_id}</code></td>
                              <td>
                                <input
                                  type="text"
                                  className="admin-device-input"
                                  value={deviceEdits[device.id]?.device_name ?? ''}
                                  onChange={(e) => updateDeviceEdit(device.id, 'device_name', e.target.value)}
                                />
                              </td>
                              <td>
                                <select
                                  className="admin-device-select"
                                  value={deviceEdits[device.id]?.hive_id ?? ''}
                                  onChange={(e) => updateDeviceEdit(device.id, 'hive_id', e.target.value)}
                                >
                                  <option value="">Unassigned</option>
                                  {hives.map((hive) => (
                                    <option key={hive.id} value={hive.id}>{hive.label}</option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                {device.last_seen_at
                                  ? new Date(device.last_seen_at).toLocaleString()
                                  : '—'}
                              </td>
                              <td>
                                {device.latest_sensors?.internal_temp_c != null
                                  ? `${device.latest_sensors.internal_temp_c}°C`
                                  : '—'}
                              </td>
                              <td className="admin-device-actions">
                                <button type="button" className="btn-primary btn-sm" onClick={() => handleSaveDevice(device)}>
                                  Save
                                </button>
                                <button type="button" className="btn-secondary btn-sm" onClick={() => handleDeleteDevice(device)}>
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'shop' && (
            <div className="admin-section admin-shop">
              <div className="section-header">
                <h3>Shop products ({products.length})</h3>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => {
                      setShowCreateCategory(true);
                      setShopError(null);
                    }}
                    className="btn-primary"
                  >
                    + Add category
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateProduct(true);
                      setEditingProduct(null);
                      setShopError(null);
                    }}
                    className="btn-primary"
                  >
                    + Add product
                  </button>
                </div>
              </div>
              {shopError && (
                <div className="admin-shop-error">{shopError}</div>
              )}
              {showCreateCategory && (
                <div className="admin-product-form create-product-form">
                  <h4>Create category</h4>
                  <form onSubmit={handleCreateCategory}>
                    <div className="form-group">
                      <label>Category Name</label>
                      <input
                        value={newCategory.name}
                        onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                        required
                        placeholder="e.g., Hive & Frames"
                      />
                    </div>
                    <div className="form-group">
                      <label>Description (optional)</label>
                      <textarea
                        value={newCategory.description}
                        onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                        rows={2}
                        placeholder="Brief description of this category"
                      />
                    </div>
                    <div className="form-actions">
                      <button type="submit" className="btn-primary">Create Category</button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateCategory(false);
                          setNewCategory({ name: '', description: '' });
                        }}
                        className="btn-secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}
              <div style={{ marginBottom: '20px', padding: '15px', background: '#f5f5f5', borderRadius: '5px' }}>
                <h4 style={{ marginTop: 0 }}>Categories ({categories.length})</h4>
                {categories.length === 0 ? (
                  <p>No categories yet. Create one to organize your products.</p>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    {categories.map((cat) => (
                      <div key={cat.id} style={{ padding: '8px 12px', background: 'white', borderRadius: '4px', border: '1px solid #ddd' }}>
                        <strong>{cat.name}</strong>
                        {cat.description && <div style={{ fontSize: '0.9em', color: '#666', marginTop: '4px' }}>{cat.description}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {showCreateProduct && (
                <div className="admin-product-form create-product-form">
                  <h4>Create product</h4>
                  <form onSubmit={handleCreateProduct}>
                    <div className="form-group">
                      <label>Name</label>
                      <input
                        value={newProduct.name}
                        onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Description</label>
                      <textarea
                        value={newProduct.description}
                        onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                        rows={3}
                      />
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Price</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={newProduct.price}
                          onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Stock</label>
                        <input
                          type="number"
                          min="0"
                          value={newProduct.stock_quantity}
                          onChange={(e) => setNewProduct({ ...newProduct, stock_quantity: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Category</label>
                      <select
                        value={newProduct.category_id}
                        onChange={(e) => setNewProduct({ ...newProduct, category_id: e.target.value })}
                      >
                        <option value="">— None —</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>SKU (optional)</label>
                      <input
                        value={newProduct.sku}
                        onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                      />
                    </div>
                    <div className="form-actions">
                      <button type="submit" className="btn-primary">Create</button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateProduct(false);
                          setNewProduct({ name: '', description: '', price: '', stock_quantity: '0', category_id: '', sku: '' });
                        }}
                        className="btn-secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}
              {editingProduct && (
                <div className="admin-product-form edit-product-form">
                  <h4>Edit product</h4>
                  <form onSubmit={handleUpdateProduct}>
                    <div className="form-group">
                      <label>Name</label>
                      <input
                        value={editProduct.name}
                        onChange={(e) => setEditProduct({ ...editProduct, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Description</label>
                      <textarea
                        value={editProduct.description}
                        onChange={(e) => setEditProduct({ ...editProduct, description: e.target.value })}
                        rows={3}
                      />
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Price</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editProduct.price}
                          onChange={(e) => setEditProduct({ ...editProduct, price: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Stock</label>
                        <input
                          type="number"
                          min="0"
                          value={editProduct.stock_quantity}
                          onChange={(e) => setEditProduct({ ...editProduct, stock_quantity: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Category</label>
                      <select
                        value={editProduct.category_id}
                        onChange={(e) => setEditProduct({ ...editProduct, category_id: e.target.value })}
                      >
                        <option value="">— None —</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>SKU (optional)</label>
                      <input
                        value={editProduct.sku}
                        onChange={(e) => setEditProduct({ ...editProduct, sku: e.target.value })}
                      />
                    </div>
                    <ProductImageUpload
                      productId={editingProduct.id}
                      imageUrl={editingProduct.image_url}
                      onImageChange={refreshEditedProduct}
                    />
                    <div className="form-actions">
                      <button type="submit" className="btn-primary">Save</button>
                      <button
                        type="button"
                        onClick={() => setEditingProduct(null)}
                        className="btn-secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}
              <div className="admin-products-list">
                {products.length === 0 ? (
                  <p className="admin-products-empty">No products. Add one above.</p>
                ) : (
                  <div className="admin-products-grid">
                    {products.map((p) => (
                      <div key={p.id} className="admin-product-card">
                        <div className="admin-product-thumb">
                          {p.image_url ? (
                            <img src={p.image_url} alt="" />
                          ) : (
                            <span className="admin-product-no-img">No image</span>
                          )}
                        </div>
                        <div className="admin-product-info">
                          <div className="admin-product-name">{p.name}</div>
                          <div className="admin-product-meta">
                            {p.category_name && <span>{p.category_name}</span>}
                            <span>£{Number(p.price).toFixed(2)}</span>
                            <span className={p.stock_quantity > 0 ? 'in-stock' : 'out-of-stock'}>
                              {p.stock_quantity} in stock
                            </span>
                          </div>
                        </div>
                        <div className="admin-product-actions">
                          <button
                            type="button"
                            onClick={() => {
                              setShowCreateProduct(false);
                              startEditProduct(p);
                            }}
                            className="btn-primary btn-small"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(p)}
                            className="btn-secondary btn-small admin-product-delete"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
