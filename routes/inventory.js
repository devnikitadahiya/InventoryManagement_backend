const express = require('express');

const router = express.Router();

const verifyToken = require('../middleware/auth');
const inventoryController = require('../controllers/inventoryController');

// GET /api/inventory/status
router.get('/status', verifyToken, inventoryController.getInventoryStatus);

// GET /api/inventory/low-stock
router.get('/low-stock', verifyToken, inventoryController.getLowStockItems);

// GET /api/inventory/history/:product_id
router.get('/history/:product_id', verifyToken, inventoryController.getStockHistory);

module.exports = router;
