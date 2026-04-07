const express = require('express');

const router = express.Router();

const verifyToken = require('../middleware/auth');
const forecastController = require('../controllers/forecastController');

// GET /api/forecast/summary?days=30
router.get('/summary', verifyToken, forecastController.getForecastSummary);

// GET /api/forecast/:product_id?days=30
router.get('/:product_id', verifyToken, forecastController.getDemandForecast);

// POST /api/forecast/refresh-alerts
router.post('/refresh-alerts', verifyToken, forecastController.refreshPredictedStockoutAlerts);

module.exports = router;
