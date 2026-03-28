const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import database connection
const db = require('./config/database');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Test route
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Smart Inventory Management API is running!',
        version: '1.0.0'
    });
});

// Health check route
app.get('/api/health', async (req, res) => {
    try {
        // Test database connection
        await db.query('SELECT 1');
        res.json({
            success: true,
            status: 'healthy',
            database: 'connected',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            status: 'unhealthy',
            database: 'disconnected',
            error: error.message
        });
    }
});

// Import routes (we'll create these next)
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/analytics', require('./routes/analytics'));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        error: {
            code: 'SERVER_ERROR',
            message: 'Something went wrong!'
        }
    });
});

if (process.env.NODE_ENV !== 'test') {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`🚀 Server is running on http://localhost:${PORT}`);
        console.log(`📊 Environment: ${process.env.NODE_ENV}`);
        console.log(`✅ Ready to accept connections!`);
    });
}

module.exports = app;