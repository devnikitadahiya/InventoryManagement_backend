const express = require('express');

const router = express.Router();

const authController = require('../controllers/authController');
const verifyToken = require('../middleware/auth');

// Register Route
// POST /api/auth/register
router.post('/register', authController.register);

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

module.exports = router;