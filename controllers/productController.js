const db = require('../config/database');

const MAX_TEXT_LENGTH = 255;
const MAX_SKU_LENGTH = 64;
const MAX_NUMERIC_VALUE = 1000000000;

const hasUnsafeText = (value) => /[<>]/.test(String(value || ''));

const validateTextField = (value, field, maxLength) => {
    if (value === undefined || value === null) {
        return null;
    }

    const text = String(value).trim();
    if (!text) {
        return `${field} cannot be empty`;
    }

    if (text.length > maxLength) {
        return `${field} cannot exceed ${maxLength} characters`;
    }

    if (hasUnsafeText(text)) {
        return `${field} contains unsupported characters`;
    }

    return null;
};

const validateBoundedNumber = (value, field) => {
    if (!Number.isFinite(value) || value < 0) {
        return `${field} must be a valid non-negative number`;
    }

    if (value > MAX_NUMERIC_VALUE) {
        return `${field} cannot exceed ${MAX_NUMERIC_VALUE}`;
    }

    return null;
};

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

        const skuError = validateTextField(sku, 'sku', MAX_SKU_LENGTH);
        if (skuError) {
            return res.status(400).json({ success: false, message: skuError });
        }

        const productNameError = validateTextField(product_name, 'product_name', MAX_TEXT_LENGTH);
        if (productNameError) {
            return res.status(400).json({ success: false, message: productNameError });
        }

        const parsedUnitPrice = Number(unit_price);
        const parsedCostPrice = cost_price === undefined || cost_price === null ? null : Number(cost_price);
        const parsedCurrentStock = current_stock === undefined || current_stock === null ? 0 : Number(current_stock);
        const parsedReorderLevel = reorder_level === undefined || reorder_level === null ? 10 : Number(reorder_level);
        const parsedReorderQuantity = reorder_quantity === undefined || reorder_quantity === null ? 50 : Number(reorder_quantity);

        const unitPriceError = validateBoundedNumber(parsedUnitPrice, 'unit_price');
        if (unitPriceError) {
            return res.status(400).json({
                success: false,
                message: unitPriceError
            });
        }

        if (parsedCostPrice !== null) {
            const costPriceError = validateBoundedNumber(parsedCostPrice, 'cost_price');
            if (costPriceError) {
                return res.status(400).json({
                    success: false,
                    message: costPriceError
                });
            }
        }

        const currentStockError = validateBoundedNumber(parsedCurrentStock, 'current_stock');
        if (currentStockError) {
            return res.status(400).json({
                success: false,
                message: currentStockError
            });
        }

        const reorderLevelError = validateBoundedNumber(parsedReorderLevel, 'reorder_level');
        if (reorderLevelError) {
            return res.status(400).json({
                success: false,
                message: reorderLevelError
            });
        }

        const reorderQtyError = validateBoundedNumber(parsedReorderQuantity, 'reorder_quantity');
        if (reorderQtyError) {
            return res.status(400).json({
                success: false,
                message: reorderQtyError
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
                parsedUnitPrice,
                parsedCostPrice,
                parsedCurrentStock,
                parsedReorderLevel,
                parsedReorderQuantity,
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
                unit_price: parsedUnitPrice,
                current_stock: parsedCurrentStock
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

        if (Object.prototype.hasOwnProperty.call(req.body, 'sku')) {
            const skuError = validateTextField(req.body.sku, 'sku', MAX_SKU_LENGTH);
            if (skuError) {
                return res.status(400).json({ success: false, message: skuError });
            }
        }

        if (Object.prototype.hasOwnProperty.call(req.body, 'product_name')) {
            const productNameError = validateTextField(req.body.product_name, 'product_name', MAX_TEXT_LENGTH);
            if (productNameError) {
                return res.status(400).json({ success: false, message: productNameError });
            }
        }

        if (Object.prototype.hasOwnProperty.call(req.body, 'unit_price')) {
            const parsed = Number(req.body.unit_price);
            const numericError = validateBoundedNumber(parsed, 'unit_price');
            if (numericError) {
                return res.status(400).json({
                    success: false,
                    message: numericError
                });
            }
        }

        if (Object.prototype.hasOwnProperty.call(req.body, 'cost_price') && req.body.cost_price !== null) {
            const parsed = Number(req.body.cost_price);
            const numericError = validateBoundedNumber(parsed, 'cost_price');
            if (numericError) {
                return res.status(400).json({
                    success: false,
                    message: numericError
                });
            }
        }

        if (Object.prototype.hasOwnProperty.call(req.body, 'current_stock')) {
            const parsed = Number(req.body.current_stock);
            const numericError = validateBoundedNumber(parsed, 'current_stock');
            if (numericError) {
                return res.status(400).json({
                    success: false,
                    message: numericError
                });
            }
        }

        if (Object.prototype.hasOwnProperty.call(req.body, 'reorder_level')) {
            const parsed = Number(req.body.reorder_level);
            const numericError = validateBoundedNumber(parsed, 'reorder_level');
            if (numericError) {
                return res.status(400).json({
                    success: false,
                    message: numericError
                });
            }
        }

        if (Object.prototype.hasOwnProperty.call(req.body, 'reorder_quantity')) {
            const parsed = Number(req.body.reorder_quantity);
            const numericError = validateBoundedNumber(parsed, 'reorder_quantity');
            if (numericError) {
                return res.status(400).json({
                    success: false,
                    message: numericError
                });
            }
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
