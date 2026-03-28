const db = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const register = async (req, res) => {
    try {
        const { full_name, email, password, role } = req.body;

        if (!full_name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'full_name, email, and password are required'
            });
        }

        const [existingUser] = await db.query(
            'SELECT user_id FROM users WHERE email = ?',
            [email]
        );

        if (existingUser.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'This email is already registered'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const [result] = await db.query(
            'INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)',
            [full_name, email, hashedPassword, role || 'staff']
        );

        res.status(201).json({
            success: true,
            message: 'User registered successfully ✅',
            data: {
                user_id: result.insertId,
                full_name,
                email,
                role: role || 'staff'
            }
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error occurred',
            error: error.message
        });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        const [users] = await db.query(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        const user = users[0];
        const isPasswordCorrect = await bcrypt.compare(password, user.password_hash);

        if (!isPasswordCorrect) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        const token = jwt.sign(
            { id: user.user_id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );

        res.json({
            success: true,
            message: 'Login successful ✅',
            data: {
                token,
                user: {
                    user_id: user.user_id,
                    full_name: user.full_name,
                    email: user.email,
                    role: user.role
                }
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error occurred',
            error: error.message
        });
    }
};

const getUsers = async (req, res) => {
    try {
        const [users] = await db.query(
            'SELECT user_id, full_name, email, role, created_at FROM users ORDER BY created_at DESC'
        );
        res.json({ success: true, data: users });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ success: false, message: 'Server error occurred', error: error.message });
    }
};

module.exports = { register, login, getUsers };