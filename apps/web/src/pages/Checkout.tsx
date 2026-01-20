import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import './Checkout.css';

export default function Checkout() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    shipping_address: '',
    payment_method: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.post('/shop/checkout', formData);
      navigate('/shop/orders');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Checkout failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="checkout">
      <h2>Checkout</h2>
      <form onSubmit={handleSubmit} className="checkout-form">
        <div className="form-group">
          <label>Shipping Address</label>
          <textarea
            value={formData.shipping_address}
            onChange={(e) => setFormData({ ...formData, shipping_address: e.target.value })}
            rows={4}
            required
          />
        </div>
        <div className="form-group">
          <label>Payment Method</label>
          <input
            type="text"
            value={formData.payment_method}
            onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
            placeholder="e.g., Credit Card, PayPal"
          />
        </div>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Processing...' : 'Complete Order'}
        </button>
      </form>
    </div>
  );
}
