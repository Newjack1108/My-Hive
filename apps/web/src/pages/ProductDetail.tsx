import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import './ProductDetail.css';

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadProduct();
  }, [id]);

  const loadProduct = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/shop/products/${id}`);
      setProduct(res.data.product);
    } catch (error) {
      console.error('Failed to load product:', error);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = async () => {
    try {
      await api.post('/shop/cart', { product_id: id, quantity });
      alert('Added to cart!');
      navigate('/shop/cart');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to add to cart');
    }
  };

  if (loading) return <div className="product-loading">Loading...</div>;
  if (!product) return <div>Product not found</div>;

  return (
    <div className="product-detail">
      <button onClick={() => navigate('/shop')} className="back-btn">← Back to Shop</button>
      <div className="product-detail-content">
        {product.image_url && (
          <img src={product.image_url} alt={product.name} className="product-detail-image" />
        )}
        <div className="product-detail-info">
          <h1>{product.name}</h1>
          {product.description && <p className="description">{product.description}</p>}
          <div className="price">${product.price.toFixed(2)}</div>
          <div className={`stock ${product.stock_quantity > 0 ? 'in-stock' : 'out-of-stock'}`}>
            {product.stock_quantity > 0 ? `In Stock (${product.stock_quantity} available)` : 'Out of Stock'}
          </div>
          {product.stock_quantity > 0 && (
            <div className="add-to-cart">
              <label>
                Quantity:
                <input
                  type="number"
                  min="1"
                  max={product.stock_quantity}
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                />
              </label>
              <button onClick={addToCart} className="btn-primary">Add to Cart</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
