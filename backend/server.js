const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL connection pool
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'zk_marketplace',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password'
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Database connection error:', err);
    } else {
        console.log('✅ Database connected successfully');
    }
});

// ============ HEALTH CHECK ============

app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        service: 'ZK Marketplace API'
    });
});

// ============ USER ENDPOINTS ============

/**
 * Get user profile and reputation
 * GET /api/users/:address
 */
app.get('/api/users/:address', async (req, res) => {
    try {
        const { address } = req.params;
        
        const result = await pool.query(
            `SELECT 
                address,
                reputation_score,
                is_verified,
                created_at,
                updated_at,
                (SELECT COUNT(*) FROM orders WHERE seller_address = $1) as total_sales,
                (SELECT COUNT(*) FROM orders WHERE buyer_address = $1) as total_purchases,
                (SELECT COUNT(*) FROM orders WHERE seller_address = $1 AND status = 'confirmed') as successful_sales,
                (SELECT COUNT(*) FROM disputes WHERE raised_by = $1) as disputes_raised
            FROM users 
            WHERE address = $1`,
            [address.toLowerCase()]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const user = result.rows[0];
        const successRate = user.total_sales > 0 
            ? Math.round((user.successful_sales / user.total_sales) * 100)
            : 0;
        
        res.json({
            ...user,
            success_rate: successRate
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Create or update user
 * POST /api/users
 */
app.post('/api/users', async (req, res) => {
    try {
        const { address, reputation_score = 50, is_verified = false } = req.body;
        
        if (!address) {
            return res.status(400).json({ error: 'Address is required' });
        }
        
        const result = await pool.query(
            `INSERT INTO users (address, reputation_score, is_verified)
             VALUES ($1, $2, $3)
             ON CONFLICT (address) 
             DO UPDATE SET 
                reputation_score = EXCLUDED.reputation_score,
                is_verified = EXCLUDED.is_verified,
                updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [address.toLowerCase(), reputation_score, is_verified]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating/updating user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Get user's orders
 * GET /api/users/:address/orders?role=seller|buyer
 */
app.get('/api/users/:address/orders', async (req, res) => {
    try {
        const { address } = req.params;
        const { role } = req.query; // 'seller' or 'buyer'
        
        let query;
        if (role === 'seller') {
            query = 'SELECT * FROM orders WHERE seller_address = $1 ORDER BY created_at DESC';
        } else if (role === 'buyer') {
            query = 'SELECT * FROM orders WHERE buyer_address = $1 ORDER BY created_at DESC';
        } else {
            query = 'SELECT * FROM orders WHERE seller_address = $1 OR buyer_address = $1 ORDER BY created_at DESC';
        }
        
        const result = await pool.query(query, [address.toLowerCase()]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching user orders:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============ ORDER ENDPOINTS ============

/**
 * Get all orders (with pagination)
 * GET /api/orders?page=1&limit=20&status=pending
 */
app.get('/api/orders', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const status = req.query.status;
        
        let query = `
            SELECT 
                o.*,
                s.reputation_score as seller_reputation,
                s.is_verified as seller_verified,
                b.reputation_score as buyer_reputation,
                b.is_verified as buyer_verified
            FROM orders o
            LEFT JOIN users s ON o.seller_address = s.address
            LEFT JOIN users b ON o.buyer_address = b.address
        `;
        
        const params = [];
        if (status) {
            query += ' WHERE o.status = $1';
            params.push(status);
        }
        
        query += ' ORDER BY o.created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
        params.push(limit, offset);
        
        const result = await pool.query(query, params);
        
        // Get total count
        const countQuery = status 
            ? 'SELECT COUNT(*) FROM orders WHERE status = $1'
            : 'SELECT COUNT(*) FROM orders';
        const countParams = status ? [status] : [];
        const countResult = await pool.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].count);
        
        res.json({
            orders: result.rows,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Get specific order
 * GET /api/orders/:orderId
 */
app.get('/api/orders/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        
        const result = await pool.query(
            `SELECT 
                o.*,
                s.reputation_score as seller_reputation,
                s.is_verified as seller_verified,
                b.reputation_score as buyer_reputation,
                b.is_verified as buyer_verified,
                (SELECT COUNT(*) FROM disputes WHERE order_id = o.order_id) as dispute_count
            FROM orders o
            LEFT JOIN users s ON o.seller_address = s.address
            LEFT JOIN users b ON o.buyer_address = b.address
            WHERE o.order_id = $1`,
            [orderId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============ DISPUTE ENDPOINTS ============

/**
 * Get disputes
 * GET /api/disputes?status=open
 */
app.get('/api/disputes', async (req, res) => {
    try {
        const { status } = req.query;
        
        let query = `
            SELECT 
                d.*,
                o.seller_address,
                o.buyer_address,
                o.amount_wei,
                o.description as order_description
            FROM disputes d
            JOIN orders o ON d.order_id = o.order_id
        `;
        
        const params = [];
        if (status) {
            query += ' WHERE d.status = $1';
            params.push(status);
        }
        
        query += ' ORDER BY d.created_at DESC';
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching disputes:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Get dispute evidence
 * GET /api/disputes/:disputeId/evidence
 */
app.get('/api/disputes/:disputeId/evidence', async (req, res) => {
    try {
        const { disputeId } = req.params;
        
        const result = await pool.query(
            'SELECT * FROM evidence WHERE dispute_id = $1 ORDER BY created_at ASC',
            [disputeId]
        );
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching evidence:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============ STATISTICS ENDPOINTS ============

/**
 * Get marketplace statistics
 * GET /api/stats
 */
app.get('/api/stats', async (req, res) => {
    try {
        const stats = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM users) as total_users,
                (SELECT COUNT(*) FROM users WHERE is_verified = true) as verified_users,
                (SELECT COUNT(*) FROM orders) as total_orders,
                (SELECT COUNT(*) FROM orders WHERE status = 'confirmed') as completed_orders,
                (SELECT COUNT(*) FROM disputes) as total_disputes,
                (SELECT COUNT(*) FROM disputes WHERE status = 'open') as open_disputes,
                (SELECT COALESCE(SUM(amount_wei), 0) FROM orders WHERE status = 'confirmed') as total_volume,
                (SELECT AVG(reputation_score)::INTEGER FROM users) as avg_reputation
        `);
        
        res.json(stats.rows[0]);
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Get leaderboard (top users by reputation)
 * GET /api/leaderboard?limit=10
 */
app.get('/api/leaderboard', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        
        const result = await pool.query(
            `SELECT 
                address,
                reputation_score,
                is_verified,
                (SELECT COUNT(*) FROM orders WHERE seller_address = users.address AND status = 'confirmed') as successful_sales
            FROM users
            ORDER BY reputation_score DESC
            LIMIT $1`,
            [limit]
        );
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============ REPUTATION ENDPOINTS ============

/**
 * Get reputation history for a user
 * GET /api/reputation/:address
 */
app.get('/api/reputation/:address', async (req, res) => {
    try {
        const { address } = req.params;
        
        const result = await pool.query(
            `SELECT * FROM reputation_history 
             WHERE user_address = $1 
             ORDER BY created_at DESC`,
            [address.toLowerCase()]
        );
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching reputation history:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============ ERROR HANDLING ============

app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ============ START SERVER ============

app.listen(PORT, () => {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 ZK Marketplace API Server');
    console.log('='.repeat(60));
    console.log(`📡 Server running on http://localhost:${PORT}`);
    console.log(`🗄️  Database: ${process.env.DB_NAME || 'zk_marketplace'}`);
    console.log('='.repeat(60) + '\n');
    console.log('📚 Available endpoints:');
    console.log('   GET  /health');
    console.log('   GET  /api/users/:address');
    console.log('   POST /api/users');
    console.log('   GET  /api/users/:address/orders');
    console.log('   GET  /api/orders');
    console.log('   GET  /api/orders/:orderId');
    console.log('   GET  /api/disputes');
    console.log('   GET  /api/stats');
    console.log('   GET  /api/leaderboard');
    console.log('   GET  /api/reputation/:address');
    console.log('\n');
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n\n🛑 Shutting down gracefully...');
    await pool.end();
    console.log('✅ Database connections closed');
    process.exit(0);
});

module.exports = app;


