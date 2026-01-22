import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import './Cart.css';

interface CartItem {
  id: string;
  product_id: string;
  product_name: string;
  price: number;
  quantity: number;
  image_url?: string;
}

export default function Cart() {
  const navigate = useNavigate();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCart();
  }, []);

  const loadCart = async () => {
    try {
      setLoading(true);
      const res = await api.get('/shop/cart');
      // Convert price from string (PostgreSQL DECIMAL) to number
      const items = res.data.cart_items.map((item: any) => ({
        ...item,
        price: typeof item.price === 'string' ? parseFloat(item.price) : item.price,
        quantity: typeof item.quantity === 'string' ? parseInt(item.quantity) : item.quantity
      }));
      setItems(items);
    } catch (error) {
      console.error('Failed to load cart:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = async (id: string, quantity: number) => {
    if (quantity < 1) return;
    try {
      await api.patch(`/shop/cart/${id}`, { quantity });
      loadCart();
    } catch (error) {
      console.error('Failed to update cart:', error);
    }
  };

  const removeItem = async (id: string) => {
    try {
      await api.delete(`/shop/cart/${id}`);
      loadCart();
    } catch (error) {
      console.error('Failed to remove item:', error);
    }
  };

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  if (loading) return <div className="cart-loading">Loading...</div>;

  return (
    <div className="cart">
      <h2>Shopping Cart</h2>
      {items.length === 0 ? (
        <div className="empty-cart">
          <p>Your cart is empty</p>
          <button onClick={() => navigate('/shop')} className="btn-primary">Continue Shopping</button>
        </div>
      ) : (
        <>
          <div className="cart-items">
            {items.map((item) => (
              <div key={item.id} className="cart-item">
                {item.image_url && (
                  <img src={item.image_url} alt={item.product_name} className="cart-item-image" />
                )}
                <div className="cart-item-info">
                  <h3>{item.product_name}</h3>
                  <div className="cart-item-controls">
                    <div className="quantity-controls">
                      <button onClick={() => updateQuantity(item.id, item.quantity - 1)}>-</button>
                      <span>{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button>
                    </div>
                    <div className="cart-item-price">£{(item.price * item.quantity).toFixed(2)}</div>
                    <button onClick={() => removeItem(item.id)} className="remove-btn">Remove</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="cart-summary">
            <div className="cart-total">
              <strong>Total: £{total.toFixed(2)}</strong>
            </div>
            <button onClick={() => navigate('/shop/checkout')} className="btn-primary checkout-btn">
              Proceed to Checkout
            </button>
          </div>
        </>
      )}
    </div>
  );
}
