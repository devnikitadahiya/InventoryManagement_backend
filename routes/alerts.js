const express = require('express');

const router = express.Router();

const verifyToken = require('../middleware/auth');
const alertsController = require('../controllers/alertsController');

const requireRole = (...roles) => (req, res, next) => {
    if (!roles.includes(req.user.role)) {
        return res.status(403).json({ success: false, message: 'Access denied: insufficient permissions' });
    }
    next();
};

// GET /api/alerts
router.get('/', verifyToken, alertsController.getAlerts);

// GET /api/alerts/:id
router.get('/:id', verifyToken, alertsController.getAlertById);

// POST /api/alerts
router.post('/', verifyToken, requireRole('admin', 'manager'), alertsController.createAlert);

// PUT /api/alerts/:id/read
router.put('/:id/read', verifyToken, alertsController.markAlertRead);

// PUT /api/alerts/:id/resolve
router.put('/:id/resolve', verifyToken, alertsController.resolveAlert);

// DELETE /api/alerts/:id
router.delete('/:id', verifyToken, requireRole('admin'), alertsController.deleteAlert);

module.exports = router;
