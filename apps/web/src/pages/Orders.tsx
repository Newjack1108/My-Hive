import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import './Orders.css';

interface Order {
  id: string;
  total: number;
  status: string;
  created_at: string;
  items?: any[];
}

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const res = await api.get('/shop/orders');
      // Convert total from string (PostgreSQL DECIMAL) to number
      const orders = res.data.orders.map((order: any) => ({
        ...order,
        total: typeof order.total === 'string' ? parseFloat(order.total) : order.total
      }));
      setOrders(orders);
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="orders-loading">Loading...</div>;

  return (
    <div className="orders">
      <h2>Order History</h2>
      {orders.length === 0 ? (
        <p>No orders found</p>
      ) : (
        <div className="orders-list">
          {orders.map((order) => (
            <div key={order.id} className="order-item">
              <div className="order-header">
                <div>
                  <strong>Order #{order.id.slice(0, 8)}</strong>
                  <span className={`status status-${order.status}`}>{order.status}</span>
                </div>
                <div className="order-total">£{order.total.toFixed(2)}</div>
              </div>
              <div className="order-date">
                {new Date(order.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
