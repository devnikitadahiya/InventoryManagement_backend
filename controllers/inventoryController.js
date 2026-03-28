const db = require('../config/database');

const getInventoryStatus = async (req, res) => {
    try {
        const [summaryRows] = await db.query(
            `SELECT
                COUNT(*) AS total_products,
                SUM(CASE WHEN p.current_stock = 0 THEN 1 ELSE 0 END) AS out_of_stock_items,
                SUM(CASE WHEN p.current_stock > 0 AND p.current_stock <= p.reorder_level THEN 1 ELSE 0 END) AS low_stock_items,
                SUM(CASE WHEN p.current_stock > p.reorder_level THEN 1 ELSE 0 END) AS in_stock_items,
                COALESCE(SUM(p.current_stock), 0) AS total_stock_units,
                COALESCE(SUM(p.current_stock * p.unit_price), 0) AS total_inventory_value
            FROM products p
            WHERE p.is_active = TRUE`
        );

        const [items] = await db.query(
            `SELECT
                p.product_id,
                p.sku,
                p.product_name,
                c.category_name,
                p.current_stock,
                p.reorder_level,
                p.reorder_quantity,
                p.unit_price,
                CASE
                    WHEN p.current_stock = 0 THEN 'out_of_stock'
                    WHEN p.current_stock <= p.reorder_level THEN 'low_stock'
                    ELSE 'in_stock'
                END AS stock_status,
                p.updated_at
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.category_id
            WHERE p.is_active = TRUE
            ORDER BY p.product_name ASC`
        );

        return res.json({
            success: true,
            message: 'Inventory status fetched successfully ✅',
            data: {
                summary: summaryRows[0],
                items
            }
        });
    } catch (error) {
        console.error('Get inventory status error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error occurred',
            error: error.message
        });
    }
};

const getLowStockItems = async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;
        const offset = (page - 1) * limit;

        const [countRows] = await db.query(
            `SELECT COUNT(*) AS total
            FROM products p
            WHERE p.is_active = TRUE AND p.current_stock <= p.reorder_level`
        );

        const total = countRows[0].total;

        const [items] = await db.query(
            `SELECT
                p.product_id,
                p.sku,
                p.product_name,
                c.category_name,
                p.current_stock,
                p.reorder_level,
                p.reorder_quantity,
                p.unit_price,
                CASE
                    WHEN p.current_stock = 0 THEN 'out_of_stock'
                    ELSE 'low_stock'
                END AS stock_status,
                (p.reorder_level - p.current_stock) AS shortage_quantity,
                p.updated_at
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.category_id
            WHERE p.is_active = TRUE
              AND p.current_stock <= p.reorder_level
            ORDER BY p.current_stock ASC, p.product_name ASC
            LIMIT ? OFFSET ?`,
            [limit, offset]
        );

        return res.json({
            success: true,
            message: 'Low stock items fetched successfully ✅',
            data: items,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get low stock items error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error occurred',
            error: error.message
        });
    }
};

const getStockHistory = async (req, res) => {
    try {
        const productId = parseInt(req.params.product_id, 10);

        if (!Number.isInteger(productId) || productId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'A valid product_id is required'
            });
        }

        const { start_date: startDate, end_date: endDate } = req.query;

        let whereClause = 'WHERE sh.product_id = ?';
        const params = [productId];

        if (startDate) {
            whereClause += ' AND sh.date >= ?';
            params.push(startDate);
        }

        if (endDate) {
            whereClause += ' AND sh.date <= ?';
            params.push(endDate);
        }

        const [productRows] = await db.query(
            `SELECT product_id, sku, product_name, current_stock, reorder_level
            FROM products
            WHERE product_id = ?
            LIMIT 1`,
            [productId]
        );

        if (productRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        const [historyRows] = await db.query(
            `SELECT
                sh.history_id,
                sh.date,
                sh.opening_stock,
                sh.stock_in,
                sh.stock_out,
                sh.closing_stock,
                sh.created_at
            FROM stock_history sh
            ${whereClause}
            ORDER BY sh.date DESC, sh.history_id DESC`,
            params
        );

        return res.json({
            success: true,
            message: 'Stock history fetched successfully ✅',
            data: {
                product: productRows[0],
                history: historyRows
            }
        });
    } catch (error) {
        console.error('Get stock history error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error occurred',
            error: error.message
        });
    }
};

module.exports = {
    getInventoryStatus,
    getLowStockItems,
    getStockHistory
};
