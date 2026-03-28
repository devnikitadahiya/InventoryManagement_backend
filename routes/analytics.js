const express = require('express');

const router = express.Router();

const verifyToken = require('../middleware/auth');
const analyticsController = require('../controllers/analyticsController');

// GET /api/analytics/dashboard
router.get('/dashboard', verifyToken, analyticsController.getDashboardStats);

// GET /api/analytics/sales-trends
router.get('/sales-trends', verifyToken, analyticsController.getSalesTrends);

module.exports = router;
