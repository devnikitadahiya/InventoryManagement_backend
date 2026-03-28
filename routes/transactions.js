const express = require('express');

const router = express.Router();

const verifyToken = require('../middleware/auth');
const transactionController = require('../controllers/transactionController');

// POST /api/transactions/stock-in
router.post('/stock-in', verifyToken, transactionController.recordStockIn);

// POST /api/transactions/stock-out
router.post('/stock-out', verifyToken, transactionController.recordStockOut);

// GET /api/transactions
router.get('/', verifyToken, transactionController.getTransactionHistory);

module.exports = router;
