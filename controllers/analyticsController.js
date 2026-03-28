const db = require('../config/database');

const getDashboardStats = async (req, res) => {
    try {
        const [productSummaryRows] = await db.query(
            `SELECT
                COUNT(*) AS total_products,
                SUM(CASE WHEN current_stock = 0 THEN 1 ELSE 0 END) AS out_of_stock_items,
                SUM(CASE WHEN current_stock > 0 AND current_stock <= reorder_level THEN 1 ELSE 0 END) AS low_stock_items,
                COALESCE(SUM(current_stock * unit_price), 0) AS total_stock_value
            FROM products
            WHERE is_active = TRUE`
        );

        const [salesSummaryRows] = await db.query(
            `SELECT
                COALESCE(SUM(total_amount), 0) AS recent_sales_value,
                COUNT(*) AS recent_sales_transactions
            FROM transactions
            WHERE transaction_type = 'out'
              AND transaction_date >= (NOW() - INTERVAL 30 DAY)`
        );

        const [topSellingRows] = await db.query(
            `SELECT
                t.product_id,
                p.sku,
                p.product_name,
                SUM(t.quantity) AS quantity_sold,
                COALESCE(SUM(t.total_amount), 0) AS revenue
            FROM transactions t
            INNER JOIN products p ON t.product_id = p.product_id
            WHERE t.transaction_type = 'out'
            GROUP BY t.product_id, p.sku, p.product_name
            ORDER BY quantity_sold DESC
            LIMIT 5`
        );

        return res.json({
            success: true,
            message: 'Dashboard analytics fetched successfully ✅',
            data: {
                total_products: Number(productSummaryRows[0].total_products || 0),
                total_stock_value: Number(productSummaryRows[0].total_stock_value || 0),
                low_stock_items: Number(productSummaryRows[0].low_stock_items || 0),
                out_of_stock_items: Number(productSummaryRows[0].out_of_stock_items || 0),
                recent_sales: Number(salesSummaryRows[0].recent_sales_value || 0),
                recent_sales_transactions: Number(salesSummaryRows[0].recent_sales_transactions || 0),
                top_selling_products: topSellingRows
            }
        });
    } catch (error) {
        console.error('Get dashboard analytics error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error occurred',
            error: error.message
        });
    }
};

const getSalesTrends = async (req, res) => {
    try {
        const period = (req.query.period || 'monthly').toLowerCase();
        const startDate = req.query.start_date ? req.query.start_date.trim() : '';
        const endDate = req.query.end_date ? req.query.end_date.trim() : '';

        const periodMap = {
            daily: {
                selectExpr: 'DATE(t.transaction_date)',
                label: 'daily'
            },
            monthly: {
                selectExpr: "DATE_FORMAT(t.transaction_date, '%Y-%m')",
                label: 'monthly'
            },
            yearly: {
                selectExpr: "DATE_FORMAT(t.transaction_date, '%Y')",
                label: 'yearly'
            }
        };

        if (!periodMap[period]) {
            return res.status(400).json({
                success: false,
                message: 'period must be one of: daily, monthly, yearly'
            });
        }

        let whereClause = "WHERE t.transaction_type = 'out'";
        const params = [];

        if (startDate) {
            whereClause += ' AND DATE(t.transaction_date) >= ?';
            params.push(startDate);
        }

        if (endDate) {
            whereClause += ' AND DATE(t.transaction_date) <= ?';
            params.push(endDate);
        }

        const { selectExpr, label } = periodMap[period];

        const [rows] = await db.query(
            `SELECT
                ${selectExpr} AS period,
                COALESCE(SUM(t.quantity), 0) AS total_quantity,
                COALESCE(SUM(t.total_amount), 0) AS total_revenue,
                COUNT(*) AS transactions_count
            FROM transactions t
            ${whereClause}
            GROUP BY period
            ORDER BY period ASC`,
            params
        );

        return res.json({
            success: true,
            message: 'Sales trends fetched successfully ✅',
            data: rows,
            filters: {
                period: label,
                start_date: startDate || null,
                end_date: endDate || null
            }
        });
    } catch (error) {
        console.error('Get sales trends error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error occurred',
            error: error.message
        });
    }
};

module.exports = {
    getDashboardStats,
    getSalesTrends
};
