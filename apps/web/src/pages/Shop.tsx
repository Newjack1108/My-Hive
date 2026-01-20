import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';
import './Shop.css';

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  stock_quantity: number;
  image_url?: string;
  category_name?: string;
}

export default function Shop() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [productsRes, categoriesRes] = await Promise.all([
        api.get('/shop/products'),
        api.get('/shop/categories')
      ]);
      setProducts(productsRes.data.products);
      setCategories(categoriesRes.data.categories);
    } catch (error) {
      console.error('Failed to load shop data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = selectedCategory
    ? products.filter(p => p.category_name === selectedCategory)
    : products;

  if (loading) {
    return <div className="shop-loading">Loading...</div>;
  }

  return (
    <div className="shop">
      <div className="shop-header">
        <h2>Shop</h2>
        <Link to="/shop/cart" className="cart-link">Cart</Link>
      </div>

      <div className="shop-filters">
        <button
          className={selectedCategory === '' ? 'active' : ''}
          onClick={() => setSelectedCategory('')}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            className={selectedCategory === cat.name ? 'active' : ''}
            onClick={() => setSelectedCategory(cat.name)}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <div className="products-grid">
        {filteredProducts.length === 0 ? (
          <p>No products found</p>
        ) : (
          filteredProducts.map((product) => (
            <Link key={product.id} to={`/shop/products/${product.id}`} className="product-card">
              {product.image_url && (
                <img src={product.image_url} alt={product.name} className="product-image" />
              )}
              <div className="product-info">
                <h3>{product.name}</h3>
                {product.description && <p className="product-description">{product.description}</p>}
                <div className="product-footer">
                  <span className="product-price">${product.price.toFixed(2)}</span>
                  <span className={`stock ${product.stock_quantity > 0 ? 'in-stock' : 'out-of-stock'}`}>
                    {product.stock_quantity > 0 ? 'In Stock' : 'Out of Stock'}
                  </span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
