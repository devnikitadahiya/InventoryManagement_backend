const express = require('express');

const router = express.Router();

const verifyToken = require('../middleware/auth');
const reportsController = require('../controllers/reportsController');

// GET /api/reports/inventory
router.get('/inventory', verifyToken, reportsController.getInventoryReport);

// GET /api/reports/transactions
router.get('/transactions', verifyToken, reportsController.getTransactionReport);

// GET /api/reports/low-stock
router.get('/low-stock', verifyToken, reportsController.getLowStockReport);

// GET /api/reports/category-sales
router.get('/category-sales', verifyToken, reportsController.getCategorySalesReport);

module.exports = router;
