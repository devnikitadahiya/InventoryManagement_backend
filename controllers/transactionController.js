const db = require('../config/database');

const upsertStockHistory = async (connection, productId, openingStock, stockIn, stockOut, closingStock) => {
    const today = new Date().toISOString().slice(0, 10);

    await connection.query(
        `INSERT INTO stock_history (product_id, date, opening_stock, stock_in, stock_out, closing_stock)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            stock_in = stock_in + VALUES(stock_in),
            stock_out = stock_out + VALUES(stock_out),
            closing_stock = VALUES(closing_stock)`,
        [productId, today, openingStock, stockIn, stockOut, closingStock]
    );
};

const recordStockIn = async (req, res) => {
    let connection;

    try {
        const { product_id, quantity, unit_price, reference_number, notes } = req.body;

        if (product_id === undefined || product_id === null || quantity === undefined || quantity === null) {
            return res.status(400).json({
                success: false,
                message: 'product_id and quantity are required'
            });
        }

        const parsedProductId = parseInt(product_id, 10);
        const parsedQuantity = parseInt(quantity, 10);

        if (!Number.isInteger(parsedProductId) || parsedProductId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'A valid product_id is required'
            });
        }

        if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Quantity must be a positive integer'
            });
        }

        const parsedUnitPrice = unit_price !== undefined && unit_price !== null
            ? parseFloat(unit_price)
            : null;

        if (parsedUnitPrice !== null && Number.isNaN(parsedUnitPrice)) {
            return res.status(400).json({
                success: false,
                message: 'unit_price must be a valid number'
            });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [productRows] = await connection.query(
            `SELECT product_id, sku, product_name, current_stock
             FROM products
             WHERE product_id = ? AND is_active = TRUE
             LIMIT 1 FOR UPDATE`,
            [parsedProductId]
        );

        if (productRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        const product = productRows[0];
        const openingStock = product.current_stock;
        const closingStock = openingStock + parsedQuantity;
        const totalAmount = parsedUnitPrice !== null ? parsedUnitPrice * parsedQuantity : null;
        const createdBy = req.user?.id || null;

        const normalizedReference = reference_number ? String(reference_number).trim() : '';
        if (normalizedReference) {
            const [duplicateRefRows] = await connection.query(
                `SELECT transaction_id
                 FROM transactions
                 WHERE product_id = ? AND transaction_type = 'in' AND reference_number = ?
                 LIMIT 1`,
                [parsedProductId, normalizedReference]
            );

            if (duplicateRefRows.length > 0) {
                await connection.rollback();
                return res.status(409).json({
                    success: false,
                    message: 'Duplicate reference_number for stock-in transaction'
                });
            }
        }

        const [transactionResult] = await connection.query(
            `INSERT INTO transactions (
                product_id,
                transaction_type,
                quantity,
                unit_price,
                total_amount,
                reference_number,
                notes,
                created_by
            ) VALUES (?, 'in', ?, ?, ?, ?, ?, ?)`,
            [
                parsedProductId,
                parsedQuantity,
                parsedUnitPrice,
                totalAmount,
                normalizedReference || null,
                notes || null,
                createdBy
            ]
        );

        await connection.query(
            'UPDATE products SET current_stock = ? WHERE product_id = ?',
            [closingStock, parsedProductId]
        );

        await upsertStockHistory(connection, parsedProductId, openingStock, parsedQuantity, 0, closingStock);

        await connection.commit();

        return res.status(201).json({
            success: true,
            message: 'Stock-in transaction recorded successfully ✅',
            data: {
                transaction_id: transactionResult.insertId,
                product_id: parsedProductId,
                sku: product.sku,
                product_name: product.product_name,
                transaction_type: 'in',
                quantity: parsedQuantity,
                unit_price: parsedUnitPrice,
                total_amount: totalAmount,
                opening_stock: openingStock,
                closing_stock: closingStock,
                reference_number: normalizedReference || null
            }
        });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('Record stock-in error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error occurred',
            error: error.message
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

const recordStockOut = async (req, res) => {
    let connection;

    try {
        const { product_id, quantity, unit_price, reference_number, notes } = req.body;

        if (product_id === undefined || product_id === null || quantity === undefined || quantity === null) {
            return res.status(400).json({
                success: false,
                message: 'product_id and quantity are required'
            });
        }

        const parsedProductId = parseInt(product_id, 10);
        const parsedQuantity = parseInt(quantity, 10);

        if (!Number.isInteger(parsedProductId) || parsedProductId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'A valid product_id is required'
            });
        }

        if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Quantity must be a positive integer'
            });
        }

        const parsedUnitPrice = unit_price !== undefined && unit_price !== null
            ? parseFloat(unit_price)
            : null;

        if (parsedUnitPrice !== null && Number.isNaN(parsedUnitPrice)) {
            return res.status(400).json({
                success: false,
                message: 'unit_price must be a valid number'
            });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [productRows] = await connection.query(
            `SELECT product_id, sku, product_name, current_stock
             FROM products
             WHERE product_id = ? AND is_active = TRUE
             LIMIT 1 FOR UPDATE`,
            [parsedProductId]
        );

        if (productRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        const product = productRows[0];
        const openingStock = product.current_stock;

        if (openingStock < parsedQuantity) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Insufficient stock for this transaction'
            });
        }

        const closingStock = openingStock - parsedQuantity;
        const totalAmount = parsedUnitPrice !== null ? parsedUnitPrice * parsedQuantity : null;
        const createdBy = req.user?.id || null;

        const normalizedReference = reference_number ? String(reference_number).trim() : '';
        if (normalizedReference) {
            const [duplicateRefRows] = await connection.query(
                `SELECT transaction_id
                 FROM transactions
                 WHERE product_id = ? AND transaction_type = 'out' AND reference_number = ?
                 LIMIT 1`,
                [parsedProductId, normalizedReference]
            );

            if (duplicateRefRows.length > 0) {
                await connection.rollback();
                return res.status(409).json({
                    success: false,
                    message: 'Duplicate reference_number for stock-out transaction'
                });
            }
        }

        const [transactionResult] = await connection.query(
            `INSERT INTO transactions (
                product_id,
                transaction_type,
                quantity,
                unit_price,
                total_amount,
                reference_number,
                notes,
                created_by
            ) VALUES (?, 'out', ?, ?, ?, ?, ?, ?)`,
            [
                parsedProductId,
                parsedQuantity,
                parsedUnitPrice,
                totalAmount,
                normalizedReference || null,
                notes || null,
                createdBy
            ]
        );

        await connection.query(
            'UPDATE products SET current_stock = ? WHERE product_id = ?',
            [closingStock, parsedProductId]
        );

        await upsertStockHistory(connection, parsedProductId, openingStock, 0, parsedQuantity, closingStock);

        await connection.commit();

        return res.status(201).json({
            success: true,
            message: 'Stock-out transaction recorded successfully ✅',
            data: {
                transaction_id: transactionResult.insertId,
                product_id: parsedProductId,
                sku: product.sku,
                product_name: product.product_name,
                transaction_type: 'out',
                quantity: parsedQuantity,
                unit_price: parsedUnitPrice,
                total_amount: totalAmount,
                opening_stock: openingStock,
                closing_stock: closingStock,
                reference_number: normalizedReference || null
            }
        });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('Record stock-out error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error occurred',
            error: error.message
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

const getTransactionHistory = async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;
        const offset = (page - 1) * limit;

        const productId = req.query.product_id ? parseInt(req.query.product_id, 10) : null;
        const transactionType = req.query.type ? req.query.type.trim().toLowerCase() : '';
        const startDate = req.query.start_date ? req.query.start_date.trim() : '';
        const endDate = req.query.end_date ? req.query.end_date.trim() : '';

        if (productId !== null && (!Number.isInteger(productId) || productId <= 0)) {
            return res.status(400).json({
                success: false,
                message: 'product_id must be a valid positive integer'
            });
        }

        if (transactionType && !['in', 'out', 'adjustment'].includes(transactionType)) {
            return res.status(400).json({
                success: false,
                message: 'type must be one of: in, out, adjustment'
            });
        }

        let whereClause = 'WHERE 1=1';
        const params = [];

        if (productId !== null) {
            whereClause += ' AND t.product_id = ?';
            params.push(productId);
        }

        if (transactionType) {
            whereClause += ' AND t.transaction_type = ?';
            params.push(transactionType);
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
            `SELECT COUNT(*) AS total
             FROM transactions t
             ${whereClause}`,
            params
        );

        const total = countRows[0].total;

        const [transactions] = await db.query(
            `SELECT
                t.transaction_id,
                t.product_id,
                p.sku,
                p.product_name,
                t.transaction_type,
                t.quantity,
                t.unit_price,
                t.total_amount,
                t.reference_number,
                t.notes,
                t.transaction_date,
                t.created_by,
                u.full_name AS created_by_name
            FROM transactions t
            INNER JOIN products p ON t.product_id = p.product_id
            LEFT JOIN users u ON t.created_by = u.user_id
            ${whereClause}
            ORDER BY t.transaction_date DESC, t.transaction_id DESC
            LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        return res.json({
            success: true,
            message: 'Transaction history fetched successfully ✅',
            data: transactions,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get transaction history error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error occurred',
            error: error.message
        });
    }
};

module.exports = {
    recordStockIn,
    recordStockOut,
    getTransactionHistory
};
