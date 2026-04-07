const db = require('../config/database');

const VALID_TYPES = new Set(['low_stock', 'predicted_stockout', 'overstock', 'reorder_point']);
const VALID_SEVERITIES = new Set(['low', 'medium', 'high', 'critical']);

const getAlerts = async (req, res) => {
    try {
        const params = [];
        let where = 'WHERE 1=1';

        if (req.query.type && VALID_TYPES.has(req.query.type)) {
            where += ' AND a.alert_type = ?';
            params.push(req.query.type);
        }
        if (req.query.severity && VALID_SEVERITIES.has(req.query.severity)) {
            where += ' AND a.severity = ?';
            params.push(req.query.severity);
        }
        if (req.query.unread === 'true') {
            where += ' AND a.is_read = FALSE';
        }
        if (req.query.unresolved === 'true') {
            where += ' AND a.is_resolved = FALSE';
        }

        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
        const offset = (page - 1) * limit;

        const [countRows] = await db.query(
            `SELECT COUNT(*) AS total FROM alerts a ${where}`,
            params
        );
        const total = Number(countRows[0].total || 0);

        const [rows] = await db.query(
            `SELECT a.alert_id, a.product_id, p.sku, p.product_name,
                a.alert_type, a.message, a.severity,
                a.is_read, a.is_resolved, a.created_at, a.resolved_at,
                u.full_name AS resolved_by_name
            FROM alerts a
            LEFT JOIN products p ON a.product_id = p.product_id
            LEFT JOIN users u ON a.resolved_by = u.user_id
            ${where}
            ORDER BY a.created_at DESC
            LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        return res.json({
            success: true,
            data: rows,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    } catch (error) {
        console.error('Get alerts error:', error);
        return res.status(500).json({ success: false, message: 'Server error occurred' });
    }
};

const getAlertById = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ success: false, message: 'alert_id must be a positive integer' });
        }
        const [rows] = await db.query(
            `SELECT a.*, p.sku, p.product_name, u.full_name AS resolved_by_name
            FROM alerts a
            LEFT JOIN products p ON a.product_id = p.product_id
            LEFT JOIN users u ON a.resolved_by = u.user_id
            WHERE a.alert_id = ? LIMIT 1`,
            [id]
        );
        if (!rows.length) {
            return res.status(404).json({ success: false, message: 'Alert not found' });
        }
        return res.json({ success: true, data: rows[0] });
    } catch (error) {
        console.error('Get alert by id error:', error);
        return res.status(500).json({ success: false, message: 'Server error occurred' });
    }
};

const createAlert = async (req, res) => {
    try {
        const { product_id, alert_type, message, severity } = req.body;

        if (!alert_type || !message) {
            return res.status(400).json({ success: false, message: 'alert_type and message are required' });
        }
        if (!VALID_TYPES.has(alert_type)) {
            return res.status(400).json({
                success: false,
                message: `alert_type must be one of: ${[...VALID_TYPES].join(', ')}`,
            });
        }

        const resolvedSeverity = severity && VALID_SEVERITIES.has(severity) ? severity : 'medium';
        const resolvedProductId = product_id ? Number(product_id) : null;

        if (resolvedProductId !== null) {
            const [p] = await db.query(
                'SELECT product_id FROM products WHERE product_id = ? AND is_active = TRUE LIMIT 1',
                [resolvedProductId]
            );
            if (!p.length) {
                return res.status(404).json({ success: false, message: 'Product not found' });
            }
        }

        const [result] = await db.query(
            `INSERT INTO alerts (product_id, alert_type, message, severity, is_read, is_resolved)
             VALUES (?, ?, ?, ?, FALSE, FALSE)`,
            [resolvedProductId, alert_type, String(message).trim(), resolvedSeverity]
        );

        return res.status(201).json({
            success: true,
            message: 'Alert created',
            data: { alert_id: result.insertId },
        });
    } catch (error) {
        console.error('Create alert error:', error);
        return res.status(500).json({ success: false, message: 'Server error occurred' });
    }
};

const markAlertRead = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid alert_id' });
        }
        const [rows] = await db.query('SELECT alert_id FROM alerts WHERE alert_id = ? LIMIT 1', [id]);
        if (!rows.length) {
            return res.status(404).json({ success: false, message: 'Alert not found' });
        }
        await db.query('UPDATE alerts SET is_read = TRUE WHERE alert_id = ?', [id]);
        return res.json({ success: true, message: 'Alert marked as read' });
    } catch (error) {
        console.error('Mark alert read error:', error);
        return res.status(500).json({ success: false, message: 'Server error occurred' });
    }
};

const resolveAlert = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid alert_id' });
        }
        const [rows] = await db.query(
            'SELECT alert_id, is_resolved FROM alerts WHERE alert_id = ? LIMIT 1',
            [id]
        );
        if (!rows.length) {
            return res.status(404).json({ success: false, message: 'Alert not found' });
        }
        if (rows[0].is_resolved) {
            return res.status(409).json({ success: false, message: 'Alert already resolved' });
        }
        await db.query(
            'UPDATE alerts SET is_resolved = TRUE, resolved_at = NOW(), resolved_by = ? WHERE alert_id = ?',
            [req.user.id, id]
        );
        return res.json({ success: true, message: 'Alert resolved successfully' });
    } catch (error) {
        console.error('Resolve alert error:', error);
        return res.status(500).json({ success: false, message: 'Server error occurred' });
    }
};

const deleteAlert = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid alert_id' });
        }
        const [rows] = await db.query('SELECT alert_id FROM alerts WHERE alert_id = ? LIMIT 1', [id]);
        if (!rows.length) {
            return res.status(404).json({ success: false, message: 'Alert not found' });
        }
        await db.query('DELETE FROM alerts WHERE alert_id = ?', [id]);
        return res.json({ success: true, message: 'Alert deleted successfully' });
    } catch (error) {
        console.error('Delete alert error:', error);
        return res.status(500).json({ success: false, message: 'Server error occurred' });
    }
};

module.exports = { getAlerts, getAlertById, createAlert, markAlertRead, resolveAlert, deleteAlert };
