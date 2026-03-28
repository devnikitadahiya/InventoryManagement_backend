const express = require('express');

const router = express.Router();

const authController = require('../controllers/authController');
const verifyToken = require('../middleware/auth');

// Role-based access helper
const requireRole = (...roles) => (req, res, next) => {
    if (!roles.includes(req.user.role)) {
        return res.status(403).json({ success: false, message: 'Access denied: insufficient permissions' });
    }
    next();
};

// Register Route — requires authentication
// admin  → can create admin / manager / staff
// manager → can only create staff
// POST /api/auth/register
router.post('/register', verifyToken, (req, res, next) => {
    const callerRole = req.user.role;
    const targetRole = req.body.role || 'staff';

    if (callerRole === 'admin') return next();

    if (callerRole === 'manager') {
        if (targetRole !== 'staff') {
            return res.status(403).json({
                success: false,
                message: 'Managers can only create staff accounts'
            });
        }
        return next();
    }

    return res.status(403).json({ success: false, message: 'Access denied: insufficient permissions' });
}, authController.register);

// Login Route
// POST /api/auth/login
router.post('/login', authController.login);

// Protected route
// GET /api/auth/me
router.get('/me', verifyToken, (req, res) => {
    res.json({
        success: true,
        message: 'Protected route access granted ✅',
        user: req.user
    });
});

// Get all users — admin and manager only
// GET /api/auth/users
router.get('/users', verifyToken, requireRole('admin', 'manager'), authController.getUsers);

// Update user role — admin only
// PUT /api/auth/users/:user_id/role
router.put('/users/:user_id/role', verifyToken, requireRole('admin'), authController.updateUserRole);

// Deactivate user — admin only
// PUT /api/auth/users/:user_id/deactivate
router.put('/users/:user_id/deactivate', verifyToken, requireRole('admin'), authController.deactivateUser);

module.exports = router;