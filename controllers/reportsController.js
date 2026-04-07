const db = require('../config/database');

const getInventoryReport = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT p.product_id, p.sku, p.product_name,
                c.category_name, p.unit_price, p.cost_price,
                p.current_stock, p.reorder_level, p.reorder_quantity,
                CASE
                    WHEN p.current_stock = 0 THEN 'out_of_stock'
                    WHEN p.current_stock <= p.reorder_level THEN 'low_stock'
                    ELSE 'ok'
                END AS stock_status,
                (p.current_stock * p.unit_price) AS stock_value
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.category_id
            WHERE p.is_active = TRUE
            ORDER BY stock_status DESC, p.product_name ASC`
        );
        return res.json({ success: true, data: rows, generated_at: new Date().toISOString() });
    } catch (error) {
        console.error('Inventory report error:', error);
        return res.status(500).json({ success: false, message: 'Server error occurred' });
    }
};

const getTransactionReport = async (req, res) => {
    try {
        const type = req.query.type || '';
        const startDate = req.query.start_date ? req.query.start_date.trim() : '';
        const endDate = req.query.end_date ? req.query.end_date.trim() : '';
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
        const offset = (page - 1) * limit;

        const allowedTypes = new Set(['in', 'out', 'adjustment']);
        const params = [];
        let whereClause = 'WHERE 1=1';

        if (type && allowedTypes.has(type)) {
            whereClause += ' AND t.transaction_type = ?';
            params.push(type);
        }
        if (startDate) {
            whereClause += ' AND DATE(t.transaction_date) >= ?';
            params.push(startDate);
        }
        if (endDate) {
            whereClause += ' AND DATE(t.transaction_date) <= ?';
            params.push(endDate);
        }

        const [countRows] = await db.query(
            `SELECT COUNT(*) AS total FROM transactions t ${whereClause}`,
            params
        );
        const total = Number(countRows[0].total || 0);

        const [rows] = await db.query(
            `SELECT t.transaction_id, t.product_id, p.sku, p.product_name,
                t.transaction_type, t.quantity, t.unit_price, t.total_amount,
                t.reference_number, t.notes, t.transaction_date,
                u.full_name AS created_by_name
            FROM transactions t
            INNER JOIN products p ON t.product_id = p.product_id
            LEFT JOIN users u ON t.created_by = u.user_id
            ${whereClause}
            ORDER BY t.transaction_date DESC
            LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        return res.json({
            success: true,
            data: rows,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
            generated_at: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Transaction report error:', error);
        return res.status(500).json({ success: false, message: 'Server error occurred' });
    }
};

const getLowStockReport = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT p.product_id, p.sku, p.product_name, c.category_name,
                p.current_stock, p.reorder_level, p.reorder_quantity,
                (p.reorder_level - p.current_stock) AS units_needed,
                (p.reorder_quantity * COALESCE(p.cost_price, p.unit_price)) AS estimated_reorder_cost,
                CASE WHEN p.current_stock = 0 THEN 'out_of_stock' ELSE 'low_stock' END AS status
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.category_id
            WHERE p.is_active = TRUE AND p.current_stock <= p.reorder_level
            ORDER BY p.current_stock ASC`
        );
        return res.json({ success: true, data: rows, generated_at: new Date().toISOString() });
    } catch (error) {
        console.error('Low-stock report error:', error);
        return res.status(500).json({ success: false, message: 'Server error occurred' });
    }
};

const getCategorySalesReport = async (req, res) => {
    try {
        const startDate = req.query.start_date ? req.query.start_date.trim() : '';
        const endDate = req.query.end_date ? req.query.end_date.trim() : '';
        const params = [];
        let whereClause = "WHERE t.transaction_type = 'out'";

        if (startDate) {
            whereClause += ' AND DATE(t.transaction_date) >= ?';
            params.push(startDate);
        }
        if (endDate) {
            whereClause += ' AND DATE(t.transaction_date) <= ?';
            params.push(endDate);
        }

        const [rows] = await db.query(
            `SELECT COALESCE(c.category_name, 'Uncategorized') AS category_name,
                COUNT(DISTINCT p.product_id) AS products_count,
                SUM(t.quantity) AS total_quantity_sold,
                COALESCE(SUM(t.total_amount), 0) AS total_revenue,
                COUNT(t.transaction_id) AS transaction_count
            FROM transactions t
            INNER JOIN products p ON t.product_id = p.product_id
            LEFT JOIN categories c ON p.category_id = c.category_id
            ${whereClause}
            GROUP BY c.category_id, c.category_name
            ORDER BY total_revenue DESC`,
            params
        );
        return res.json({ success: true, data: rows, generated_at: new Date().toISOString() });
    } catch (error) {
        console.error('Category sales report error:', error);
        return res.status(500).json({ success: false, message: 'Server error occurred' });
    }
};

module.exports = { getInventoryReport, getTransactionReport, getLowStockReport, getCategorySalesReport };
