const db = require('../config/database');

// =========================================
// GET ALL PRODUCTS
// =========================================
const getAllProducts = async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;
        const offset = (page - 1) * limit;

        const search = req.query.search ? req.query.search.trim() : '';
        const category = req.query.category ? req.query.category.trim() : '';

        let whereClause = 'WHERE p.is_active = TRUE';
        const params = [];

        if (search) {
            whereClause += ' AND (p.product_name LIKE ? OR p.sku LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        if (category) {
            whereClause += ' AND c.category_name = ?';
            params.push(category);
        }

        const countQuery = `
            SELECT COUNT(*) AS total
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.category_id
            ${whereClause}
        `;

        const [countRows] = await db.query(countQuery, params);
        const total = countRows[0].total;

        const dataQuery = `
            SELECT
                p.product_id,
                p.sku,
                p.product_name,
                p.description,
                c.category_name,
                p.unit_price,
                p.cost_price,
                p.current_stock,
                p.reorder_level,
                p.reorder_quantity,
                p.unit_of_measure,
                p.created_at
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.category_id
            ${whereClause}
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?
        `;

        const [products] = await db.query(dataQuery, [...params, limit, offset]);

        return res.json({
            success: true,
            message: 'Products list fetched successfully ✅',
            data: products,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get products error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error occurred',
            error: error.message
        });
    }
};

// =========================================
// CREATE PRODUCT
// =========================================
const createProduct = async (req, res) => {
    try {
        const {
            sku,
            product_name,
            description,
            category_id,
            unit_price,
            cost_price,
            current_stock,
            reorder_level,
            reorder_quantity,
            unit_of_measure
        } = req.body;

        if (!sku || !product_name || unit_price === undefined || unit_price === null) {
            return res.status(400).json({
                success: false,
                message: 'sku, product_name, and unit_price are required'
            });
        }

        const [existingSku] = await db.query(
            'SELECT product_id FROM products WHERE sku = ?',
            [sku]
        );

        if (existingSku.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'This SKU is already in use'
            });
        }

        const createdBy = req.user?.id || null;

        const [result] = await db.query(
            `INSERT INTO products (
                sku,
                product_name,
                description,
                category_id,
                unit_price,
                cost_price,
                current_stock,
                reorder_level,
                reorder_quantity,
                unit_of_measure,
                created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                sku,
                product_name,
                description || null,
                category_id || null,
                unit_price,
                cost_price || null,
                current_stock ?? 0,
                reorder_level ?? 10,
                reorder_quantity ?? 50,
                unit_of_measure || 'pieces',
                createdBy
            ]
        );

        return res.status(201).json({
            success: true,
            message: 'Product added successfully ✅',
            data: {
                product_id: result.insertId,
                sku,
                product_name,
                category_id: category_id || null,
                unit_price,
                current_stock: current_stock ?? 0
            }
        });
    } catch (error) {
        console.error('Create product error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error occurred',
            error: error.message
        });
    }
};

// =========================================
// GET PRODUCT BY ID
// =========================================
const getProductById = async (req, res) => {
    try {
        const productId = parseInt(req.params.id, 10);

        if (!Number.isInteger(productId) || productId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'A valid product id is required'
            });
        }

        const [rows] = await db.query(
            `SELECT
                p.product_id,
                p.sku,
                p.product_name,
                p.description,
                p.category_id,
                c.category_name,
                p.unit_price,
                p.cost_price,
                p.current_stock,
                p.reorder_level,
                p.reorder_quantity,
                p.unit_of_measure,
                p.created_at,
                p.updated_at
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.category_id
            WHERE p.product_id = ? AND p.is_active = TRUE
            LIMIT 1`,
            [productId]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        return res.json({
            success: true,
            message: 'Product details fetched successfully ✅',
            data: rows[0]
        });
    } catch (error) {
        console.error('Get product by id error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error occurred',
            error: error.message
        });
    }
};

// =========================================
// UPDATE PRODUCT BY ID
// =========================================
const updateProductById = async (req, res) => {
    try {
        const productId = parseInt(req.params.id, 10);

        if (!Number.isInteger(productId) || productId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'A valid product id is required'
            });
        }

        const allowedFields = [
            'sku',
            'product_name',
            'description',
            'category_id',
            'unit_price',
            'cost_price',
            'current_stock',
            'reorder_level',
            'reorder_quantity',
            'unit_of_measure'
        ];

        const updates = [];
        const values = [];

        for (const field of allowedFields) {
            if (Object.prototype.hasOwnProperty.call(req.body, field)) {
                updates.push(`${field} = ?`);
                values.push(req.body[field]);
            }
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Provide at least one valid field to update'
            });
        }

        const [existingProduct] = await db.query(
            'SELECT product_id FROM products WHERE product_id = ? AND is_active = TRUE',
            [productId]
        );

        if (existingProduct.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        if (Object.prototype.hasOwnProperty.call(req.body, 'sku') && req.body.sku) {
            const [duplicateSku] = await db.query(
                'SELECT product_id FROM products WHERE sku = ? AND product_id != ?',
                [req.body.sku, productId]
            );

            if (duplicateSku.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'This SKU is already used by another product'
                });
            }
        }

        values.push(productId);

        await db.query(
            `UPDATE products
             SET ${updates.join(', ')}
             WHERE product_id = ? AND is_active = TRUE`,
            values
        );

        const [updatedRows] = await db.query(
            `SELECT
                p.product_id,
                p.sku,
                p.product_name,
                p.description,
                p.category_id,
                c.category_name,
                p.unit_price,
                p.cost_price,
                p.current_stock,
                p.reorder_level,
                p.reorder_quantity,
                p.unit_of_measure,
                p.created_at,
                p.updated_at
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.category_id
            WHERE p.product_id = ? AND p.is_active = TRUE
            LIMIT 1`,
            [productId]
        );

        return res.json({
            success: true,
            message: 'Product updated successfully ✅',
            data: updatedRows[0]
        });
    } catch (error) {
        console.error('Update product error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error occurred',
            error: error.message
        });
    }
};

// =========================================
// DELETE PRODUCT BY ID (SOFT DELETE)
// =========================================
const deleteProductById = async (req, res) => {
    try {
        const productId = parseInt(req.params.id, 10);

        if (!Number.isInteger(productId) || productId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'A valid product id is required'
            });
        }

        const [result] = await db.query(
            'UPDATE products SET is_active = FALSE WHERE product_id = ? AND is_active = TRUE',
            [productId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Product not found or already deleted'
            });
        }

        return res.json({
            success: true,
            message: 'Product deleted successfully (soft delete) ✅'
        });
    } catch (error) {
        console.error('Delete product error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error occurred',
            error: error.message
        });
    }
};

module.exports = {
    getAllProducts,
    createProduct,
    getProductById,
    updateProductById,
    deleteProductById
};
