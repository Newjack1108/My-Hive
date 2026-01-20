import express from 'express';
import { pool } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import {
    CreateProductCategorySchema,
    CreateProductSchema,
    UpdateProductSchema,
    AddToCartSchema,
    UpdateCartItemSchema,
    CheckoutSchema
} from '@my-hive/shared';
import { logActivity } from '../utils/activity.js';

export const shopRouter = express.Router();

shopRouter.use(authenticateToken);

// Product Categories
shopRouter.get('/categories', async (req: AuthRequest, res, next) => {
    try {
        const result = await pool.query(
            `SELECT * FROM product_categories
             WHERE org_id = $1
             ORDER BY name`,
            [req.user!.org_id]
        );

        res.json({ categories: result.rows });
    } catch (error) {
        next(error);
    }
});

shopRouter.post('/categories', async (req: AuthRequest, res, next) => {
    try {
        if (!['admin', 'manager'].includes(req.user!.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const data = CreateProductCategorySchema.parse(req.body);

        const result = await pool.query(
            `INSERT INTO product_categories (org_id, name, description)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [req.user!.org_id, data.name, data.description || null]
        );

        res.status(201).json({ category: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

// Products
shopRouter.get('/products', async (req: AuthRequest, res, next) => {
    try {
        const categoryId = req.query.category_id as string | undefined;
        const activeOnly = req.query.active !== 'false';

        let query = `
            SELECT p.*, pc.name as category_name
            FROM products p
            LEFT JOIN product_categories pc ON p.category_id = pc.id
            WHERE p.org_id = $1
        `;
        const params: any[] = [req.user!.org_id];

        if (activeOnly) {
            query += ' AND p.active = true';
        }

        if (categoryId) {
            query += ' AND p.category_id = $2';
            params.push(categoryId);
        }

        query += ' ORDER BY p.name';

        const result = await pool.query(query, params);
        res.json({ products: result.rows });
    } catch (error) {
        next(error);
    }
});

shopRouter.get('/products/:id', async (req: AuthRequest, res, next) => {
    try {
        const result = await pool.query(
            `SELECT p.*, pc.name as category_name
             FROM products p
             LEFT JOIN product_categories pc ON p.category_id = pc.id
             WHERE p.id = $1 AND p.org_id = $2`,
            [req.params.id, req.user!.org_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json({ product: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

shopRouter.post('/products', async (req: AuthRequest, res, next) => {
    try {
        if (!['admin', 'manager'].includes(req.user!.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const data = CreateProductSchema.parse(req.body);

        const result = await pool.query(
            `INSERT INTO products (org_id, category_id, name, description, price, stock_quantity, sku, image_url, active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [
                req.user!.org_id,
                data.category_id || null,
                data.name,
                data.description || null,
                data.price,
                data.stock_quantity || 0,
                data.sku || null,
                data.image_url || null,
                data.active !== false
            ]
        );

        res.status(201).json({ product: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

shopRouter.patch('/products/:id', async (req: AuthRequest, res, next) => {
    try {
        if (!['admin', 'manager'].includes(req.user!.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const data = UpdateProductSchema.parse(req.body);

        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (data.category_id !== undefined) {
            updates.push(`category_id = $${paramIndex++}`);
            values.push(data.category_id || null);
        }
        if (data.name !== undefined) {
            updates.push(`name = $${paramIndex++}`);
            values.push(data.name);
        }
        if (data.description !== undefined) {
            updates.push(`description = $${paramIndex++}`);
            values.push(data.description || null);
        }
        if (data.price !== undefined) {
            updates.push(`price = $${paramIndex++}`);
            values.push(data.price);
        }
        if (data.stock_quantity !== undefined) {
            updates.push(`stock_quantity = $${paramIndex++}`);
            values.push(data.stock_quantity);
        }
        if (data.sku !== undefined) {
            updates.push(`sku = $${paramIndex++}`);
            values.push(data.sku || null);
        }
        if (data.image_url !== undefined) {
            updates.push(`image_url = $${paramIndex++}`);
            values.push(data.image_url || null);
        }
        if (data.active !== undefined) {
            updates.push(`active = $${paramIndex++}`);
            values.push(data.active);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        values.push(req.params.id, req.user!.org_id);

        const result = await pool.query(
            `UPDATE products SET ${updates.join(', ')}
             WHERE id = $${paramIndex++} AND org_id = $${paramIndex++}
             RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json({ product: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

// Cart
shopRouter.get('/cart', async (req: AuthRequest, res, next) => {
    try {
        const result = await pool.query(
            `SELECT ci.*, p.name as product_name, p.price, p.image_url, p.stock_quantity
             FROM cart_items ci
             JOIN products p ON ci.product_id = p.id
             WHERE ci.user_id = $1 AND ci.org_id = $2
             ORDER BY ci.created_at`,
            [req.user!.id, req.user!.org_id]
        );

        res.json({ cart_items: result.rows });
    } catch (error) {
        next(error);
    }
});

shopRouter.post('/cart', async (req: AuthRequest, res, next) => {
    try {
        const data = AddToCartSchema.parse(req.body);

        // Check product exists and has stock
        const productResult = await pool.query(
            `SELECT id, stock_quantity, price FROM products
             WHERE id = $1 AND org_id = $2 AND active = true`,
            [data.product_id, req.user!.org_id]
        );

        if (productResult.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found or unavailable' });
        }

        const product = productResult.rows[0];
        if (product.stock_quantity < data.quantity) {
            return res.status(400).json({ error: 'Insufficient stock' });
        }

        // Check if item already in cart
        const existingResult = await pool.query(
            `SELECT id, quantity FROM cart_items
             WHERE user_id = $1 AND product_id = $2 AND org_id = $3`,
            [req.user!.id, data.product_id, req.user!.org_id]
        );

        if (existingResult.rows.length > 0) {
            // Update quantity
            const newQuantity = existingResult.rows[0].quantity + data.quantity;
            const result = await pool.query(
                `UPDATE cart_items SET quantity = $1, updated_at = NOW()
                 WHERE id = $2
                 RETURNING *`,
                [newQuantity, existingResult.rows[0].id]
            );
            res.json({ cart_item: result.rows[0] });
        } else {
            // Insert new item
            const result = await pool.query(
                `INSERT INTO cart_items (org_id, user_id, product_id, quantity)
                 VALUES ($1, $2, $3, $4)
                 RETURNING *`,
                [req.user!.org_id, req.user!.id, data.product_id, data.quantity]
            );
            res.status(201).json({ cart_item: result.rows[0] });
        }
    } catch (error) {
        next(error);
    }
});

shopRouter.patch('/cart/:id', async (req: AuthRequest, res, next) => {
    try {
        const data = UpdateCartItemSchema.parse(req.body);

        const result = await pool.query(
            `UPDATE cart_items SET quantity = $1, updated_at = NOW()
             WHERE id = $2 AND user_id = $3 AND org_id = $4
             RETURNING *`,
            [data.quantity, req.params.id, req.user!.id, req.user!.org_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Cart item not found' });
        }

        res.json({ cart_item: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

shopRouter.delete('/cart/:id', async (req: AuthRequest, res, next) => {
    try {
        const result = await pool.query(
            `DELETE FROM cart_items
             WHERE id = $1 AND user_id = $2 AND org_id = $3
             RETURNING id`,
            [req.params.id, req.user!.id, req.user!.org_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Cart item not found' });
        }

        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

// Checkout
shopRouter.post('/checkout', async (req: AuthRequest, res, next) => {
    try {
        const data = CheckoutSchema.parse(req.body);

        // Get cart items
        const cartResult = await pool.query(
            `SELECT ci.*, p.price, p.stock_quantity, p.name as product_name
             FROM cart_items ci
             JOIN products p ON ci.product_id = p.id
             WHERE ci.user_id = $1 AND ci.org_id = $2`,
            [req.user!.id, req.user!.org_id]
        );

        if (cartResult.rows.length === 0) {
            return res.status(400).json({ error: 'Cart is empty' });
        }

        // Validate stock and calculate total
        let total = 0;
        for (const item of cartResult.rows) {
            if (item.stock_quantity < item.quantity) {
                return res.status(400).json({ 
                    error: `Insufficient stock for ${item.product_name}` 
                });
            }
            total += parseFloat(item.price) * item.quantity;
        }

        // Create order
        const orderResult = await pool.query(
            `INSERT INTO orders (org_id, user_id, total, status, shipping_address, payment_method)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [
                req.user!.org_id,
                req.user!.id,
                total,
                'pending',
                data.shipping_address || null,
                data.payment_method || null
            ]
        );

        const order = orderResult.rows[0];

        // Create order items and update inventory
        for (const item of cartResult.rows) {
            await pool.query(
                `INSERT INTO order_items (org_id, order_id, product_id, quantity, price)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    req.user!.org_id,
                    order.id,
                    item.product_id,
                    item.quantity,
                    item.price
                ]
            );

            // Update product stock
            await pool.query(
                `UPDATE products SET stock_quantity = stock_quantity - $1
                 WHERE id = $2`,
                [item.quantity, item.product_id]
            );

            // Record inventory movement
            await pool.query(
                `INSERT INTO inventory (org_id, product_id, quantity_change, movement_type, reference_id)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    req.user!.org_id,
                    item.product_id,
                    -item.quantity,
                    'sale',
                    order.id
                ]
            );
        }

        // Clear cart
        await pool.query(
            `DELETE FROM cart_items WHERE user_id = $1 AND org_id = $2`,
            [req.user!.id, req.user!.org_id]
        );

        await logActivity(
            req.user!.org_id,
            req.user!.id,
            'create_order',
            'order',
            order.id,
            { total, items_count: cartResult.rows.length }
        );

        res.status(201).json({ order });
    } catch (error) {
        next(error);
    }
});

// Orders
shopRouter.get('/orders', async (req: AuthRequest, res, next) => {
    try {
        const result = await pool.query(
            `SELECT * FROM orders
             WHERE user_id = $1 AND org_id = $2
             ORDER BY created_at DESC`,
            [req.user!.id, req.user!.org_id]
        );

        res.json({ orders: result.rows });
    } catch (error) {
        next(error);
    }
});

shopRouter.get('/orders/:id', async (req: AuthRequest, res, next) => {
    try {
        const orderResult = await pool.query(
            `SELECT * FROM orders
             WHERE id = $1 AND user_id = $2 AND org_id = $3`,
            [req.params.id, req.user!.id, req.user!.org_id]
        );

        if (orderResult.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const order = orderResult.rows[0];

        const itemsResult = await pool.query(
            `SELECT oi.*, p.name as product_name, p.image_url
             FROM order_items oi
             JOIN products p ON oi.product_id = p.id
             WHERE oi.order_id = $1
             ORDER BY oi.created_at`,
            [order.id]
        );

        res.json({ 
            order: {
                ...order,
                items: itemsResult.rows
            }
        });
    } catch (error) {
        next(error);
    }
});
