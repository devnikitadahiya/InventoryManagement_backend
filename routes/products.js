const express = require('express');

const router = express.Router();

const verifyToken = require('../middleware/auth');

const productController = require('../controllers/productController');

const requireRole = (...roles) => (req, res, next) => {
	if (!roles.includes(req.user.role)) {
		return res.status(403).json({ success: false, message: 'Access denied: insufficient permissions' });
	}
	next();
};

// GET /api/products
router.get('/', verifyToken, productController.getAllProducts);

// GET /api/products/:id
router.get('/:id', verifyToken, productController.getProductById);

// PUT /api/products/:id
router.put('/:id', verifyToken, productController.updateProductById);

// DELETE /api/products/:id
router.delete('/:id', verifyToken, requireRole('admin', 'manager'), productController.deleteProductById);

// POST /api/products
router.post('/', verifyToken, productController.createProduct);

module.exports = router;
