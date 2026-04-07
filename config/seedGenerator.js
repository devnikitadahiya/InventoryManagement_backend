const fs = require('node:fs');
const path = require('node:path');

const CATEGORY_BLUEPRINTS = [
    {
        name: 'Electronics',
        description: 'Laptops, mobiles, accessories',
        prefix: 'ELEC',
        keywords: ['Laptop', 'Mouse', 'Keyboard', 'Headset', 'Monitor', 'Router', 'Speaker'],
        unitPriceRange: [900, 75000],
        costRatioRange: [0.62, 0.82],
    },
    {
        name: 'Furniture',
        description: 'Office chairs, tables, shelves',
        prefix: 'FURN',
        keywords: ['Chair', 'Table', 'Desk', 'Shelf', 'Cabinet', 'Stool', 'Rack'],
        unitPriceRange: [1500, 28000],
        costRatioRange: [0.58, 0.8],
    },
    {
        name: 'Stationery',
        description: 'Pens, notebooks, paper, files',
        prefix: 'STAT',
        keywords: ['Notebook', 'Pen Box', 'Marker Set', 'Paper Ream', 'File Pack', 'Stapler', 'Folder'],
        unitPriceRange: [40, 1800],
        costRatioRange: [0.5, 0.78],
    },
    {
        name: 'Food & Beverages',
        description: 'Packaged snacks and drinks',
        prefix: 'FOOD',
        keywords: ['Tea Box', 'Biscuit Pack', 'Coffee Jar', 'Juice Pack', 'Snack Combo', 'Energy Bar', 'Dry Fruits'],
        unitPriceRange: [30, 1600],
        costRatioRange: [0.55, 0.83],
    },
    {
        name: 'Clothing',
        description: 'T-shirts, uniforms, accessories',
        prefix: 'CLTH',
        keywords: ['Uniform Shirt', 'T-Shirt', 'Jacket', 'Apron', 'Cap', 'Gloves', 'Safety Vest'],
        unitPriceRange: [120, 4200],
        costRatioRange: [0.52, 0.79],
    },
];

const PROFILE_MAP = {
    small: {
        products: 25,
        months: 3,
        saleProbability: 0.14,
    },
    medium: {
        products: 75,
        months: 6,
        saleProbability: 0.2,
    },
    large: {
        products: 200,
        months: 12,
        saleProbability: 0.26,
    },
};

function createRng(seedInput) {
    if (seedInput === undefined || seedInput === null || seedInput === '') {
        return Math.random;
    }

    let seed = Number(seedInput);
    if (!Number.isFinite(seed)) {
        seed = String(seedInput)
            .split('')
            .reduce((accumulator, character) => accumulator + (character.codePointAt(0) || 0), 0);
    }

    let state = Math.abs(Math.trunc(seed)) % 2147483647;
    if (state === 0) {
        state = 1;
    }

    return () => {
        state = (state * 16807) % 2147483647;
        return (state - 1) / 2147483646;
    };
}

function randomInt(min, max, rng = Math.random) {
    return Math.floor(rng() * (max - min + 1)) + min;
}

function randomDecimal(min, max, decimals = 2, rng = Math.random) {
    const value = rng() * (max - min) + min;
    return Number(value.toFixed(decimals));
}

function pad(number, size = 2) {
    return String(number).padStart(size, '0');
}

function formatDate(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDateTime(date) {
    return `${formatDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function addDays(date, days) {
    const updated = new Date(date);
    updated.setDate(updated.getDate() + days);
    return updated;
}

function toSqlValue(value) {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
    return `'${String(value).replaceAll("'", "''")}'`;
}

function createReference(prefix, transactionDate, counter) {
    const compactDate = `${transactionDate.getFullYear()}${pad(transactionDate.getMonth() + 1)}${pad(transactionDate.getDate())}`;
    return `${prefix}-${compactDate}-${pad(counter, 4)}`;
}

function resolveProfile(profileName) {
    const key = String(profileName || 'small').toLowerCase();
    return PROFILE_MAP[key] || PROFILE_MAP.small;
}

function buildProducts(profile, rng) {
    const perCategory = Math.ceil(profile.products / CATEGORY_BLUEPRINTS.length);
    const products = [];

    CATEGORY_BLUEPRINTS.forEach((category, categoryIndex) => {
        for (let itemIndex = 1; itemIndex <= perCategory; itemIndex += 1) {
            if (products.length >= profile.products) break;

            const keyword = category.keywords[(itemIndex - 1) % category.keywords.length];
            const productName = `${keyword} ${randomInt(100, 999, rng)}`;
            const unitPrice = randomDecimal(category.unitPriceRange[0], category.unitPriceRange[1], 2, rng);
            const costRatio = randomDecimal(category.costRatioRange[0], category.costRatioRange[1], 2, rng);
            const costPrice = Number((unitPrice * costRatio).toFixed(2));
            const reorderLevel = randomInt(8, 40, rng);
            const reorderQuantity = randomInt(20, 90, rng);

            products.push({
                categoryName: category.name,
                categoryDescription: category.description,
                sku: `${category.prefix}-${pad(categoryIndex * perCategory + itemIndex, 3)}`,
                product_name: productName,
                description: `${keyword} for daily operational use`,
                unit_price: unitPrice,
                cost_price: costPrice,
                reorder_level: reorderLevel,
                reorder_quantity: reorderQuantity,
                current_stock: randomInt(reorderLevel + 2, reorderLevel + reorderQuantity + 20, rng),
                created_by: randomInt(1, 2, rng),
            });
        }
    });

    return products;
}

function simulateMovements(products, profile, rng) {
    const transactions = [];
    const salesRows = [];

    const totalDays = profile.months * 30;
    const startDate = addDays(new Date(), -totalDays);

    let stockInCounter = 1;
    let stockOutCounter = 1;

    products.forEach((product, index) => {
        let stock = randomInt(product.reorder_level + 20, product.reorder_level + product.reorder_quantity + 80, rng);
        product.current_stock = stock;

        // Initial stock-in transaction per product keeps transaction history realistic.
        const initialDate = addDays(startDate, randomInt(0, 3, rng));
        const initialQuantity = stock;
        transactions.push({
            productIndex: index,
            transaction_type: 'in',
            quantity: initialQuantity,
            unit_price: product.cost_price,
            total_amount: Number((initialQuantity * product.cost_price).toFixed(2)),
            reference_number: createReference('PO', initialDate, stockInCounter),
            notes: 'Initial dynamic stock load',
            transaction_date: formatDateTime(new Date(initialDate.setHours(9, randomInt(0, 50, rng), randomInt(0, 59, rng), 0))),
            created_by: randomInt(1, 2, rng),
        });
        stockInCounter += 1;

        for (let day = 0; day < totalDays; day += 1) {
            const date = addDays(startDate, day);

            if (rng() < profile.saleProbability && stock > 0) {
                const maxPossibleSale = Math.max(1, Math.floor(stock * 0.4));
                const soldQty = randomInt(1, Math.max(1, Math.min(maxPossibleSale, product.reorder_quantity)), rng);
                stock -= soldQty;

                const outTimestamp = new Date(date);
                outTimestamp.setHours(randomInt(10, 19, rng), randomInt(0, 59, rng), randomInt(0, 59, rng), 0);

                const saleAmount = Number((soldQty * product.unit_price).toFixed(2));
                transactions.push({
                    productIndex: index,
                    transaction_type: 'out',
                    quantity: soldQty,
                    unit_price: product.unit_price,
                    total_amount: saleAmount,
                    reference_number: createReference('INV', outTimestamp, stockOutCounter),
                    notes: 'Dynamic retail sale',
                    transaction_date: formatDateTime(outTimestamp),
                    created_by: randomInt(3, 4, rng),
                });
                stockOutCounter += 1;

                salesRows.push({
                    productIndex: index,
                    sale_date: formatDate(outTimestamp),
                    quantity_sold: soldQty,
                    revenue: saleAmount,
                });
            }

            if (stock <= product.reorder_level || (rng() < 0.03 && day > 10)) {
                const restockQty = randomInt(product.reorder_quantity, product.reorder_quantity + 50, rng);
                stock += restockQty;

                const inTimestamp = new Date(date);
                inTimestamp.setHours(randomInt(8, 16, rng), randomInt(0, 59, rng), randomInt(0, 59, rng), 0);

                const restockAmount = Number((restockQty * product.cost_price).toFixed(2));
                transactions.push({
                    productIndex: index,
                    transaction_type: 'in',
                    quantity: restockQty,
                    unit_price: product.cost_price,
                    total_amount: restockAmount,
                    reference_number: createReference('PO', inTimestamp, stockInCounter),
                    notes: 'Dynamic reorder restock',
                    transaction_date: formatDateTime(inTimestamp),
                    created_by: randomInt(1, 2, rng),
                });
                stockInCounter += 1;
            }
        }

        product.current_stock = stock;
    });

    const aggregatedSalesMap = new Map();
    salesRows.forEach((sale) => {
        const key = `${sale.productIndex}|${sale.sale_date}`;
        const existing = aggregatedSalesMap.get(key);
        if (!existing) {
            aggregatedSalesMap.set(key, { ...sale });
            return;
        }

        existing.quantity_sold += sale.quantity_sold;
        existing.revenue = Number((existing.revenue + sale.revenue).toFixed(2));
    });

    return {
        transactions,
        salesData: Array.from(aggregatedSalesMap.values()),
    };
}

function buildAlerts(products) {
    const alerts = [];

    products.forEach((product, index) => {
        if (product.current_stock <= product.reorder_level) {
            let severity = 'medium';
            if (product.current_stock === 0) {
                severity = 'critical';
            } else if (product.current_stock <= Math.floor(product.reorder_level * 0.5)) {
                severity = 'high';
            }

            alerts.push({
                productIndex: index,
                alert_type: 'low_stock',
                message: `${product.product_name} is low on stock (${product.current_stock} left, reorder at ${product.reorder_level})`,
                severity,
                is_read: false,
                is_resolved: false,
            });
        }
    });

    return alerts;
}

function buildSystemSettings() {
    return [
        ['low_stock_threshold', '10', 'Minimum stock before alert fires', 1],
        ['forecast_days', '30', 'Days to forecast demand for', 1],
        ['email_notifications', 'true', 'Send email alerts for low stock', 1],
        ['auto_reorder', 'false', 'Auto raise purchase orders on reorder', 1],
        ['currency', 'INR', 'Currency used in the system', 1],
        ['company_name', 'Smart Inventory Pvt Ltd', 'Company display name', 1],
    ];
}

function generateDynamicSeedDataset(options = {}) {
    const profile = resolveProfile(options.profile);
    const rng = createRng(options.seed);
    const products = buildProducts(profile, rng);
    const { transactions, salesData } = simulateMovements(products, profile, rng);
    const alerts = buildAlerts(products);

    return {
        profile,
        categories: CATEGORY_BLUEPRINTS.map(({ name, description }) => ({ name, description })),
        products,
        transactions,
        salesData,
        alerts,
        settings: buildSystemSettings(),
        seed: options.seed ?? null,
    };
}

function createSqlInsert(tableName, columns, rows) {
    if (!rows.length) return '';

    const values = rows
        .map((row) => `(${columns.map((column) => toSqlValue(row[column])).join(', ')})`)
        .join(',\n');

    return `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES\n${values};`;
}

function buildSqlSeedFileContent(dataset, dbName) {
    const categoryIdByName = new Map(
        dataset.categories.map((category, index) => [category.name, index + 1])
    );

    const productsForSql = dataset.products.map((product, index) => ({
        product_id: index + 1,
        sku: product.sku,
        product_name: product.product_name,
        description: product.description,
        category_id: categoryIdByName.get(product.categoryName),
        unit_price: product.unit_price,
        cost_price: product.cost_price,
        current_stock: product.current_stock,
        reorder_level: product.reorder_level,
        reorder_quantity: product.reorder_quantity,
        created_by: product.created_by,
    }));

    const transactionsForSql = dataset.transactions.map((transaction) => ({
        product_id: transaction.productIndex + 1,
        transaction_type: transaction.transaction_type,
        quantity: transaction.quantity,
        unit_price: transaction.unit_price,
        total_amount: transaction.total_amount,
        reference_number: transaction.reference_number,
        notes: transaction.notes,
        transaction_date: transaction.transaction_date,
        created_by: transaction.created_by,
    }));

    const salesForSql = dataset.salesData.map((sale) => ({
        product_id: sale.productIndex + 1,
        sale_date: sale.sale_date,
        quantity_sold: sale.quantity_sold,
        revenue: sale.revenue,
    }));

    const alertsForSql = dataset.alerts.map((alert) => ({
        product_id: alert.productIndex + 1,
        alert_type: alert.alert_type,
        message: alert.message,
        severity: alert.severity,
        is_read: alert.is_read,
        is_resolved: alert.is_resolved,
    }));

    const sections = [
        '-- ============================================================',
        '-- DYNAMIC SAMPLE DATA (AUTO-GENERATED)',
        `-- Generated at: ${new Date().toISOString()}`,
        '-- ============================================================',
        '',
        `USE ${dbName};`,
        '',
        'SET FOREIGN_KEY_CHECKS = 0;',
        'DELETE FROM forecasts;',
        'DELETE FROM sales_data;',
        'DELETE FROM stock_history;',
        'DELETE FROM transactions;',
        'DELETE FROM alerts;',
        'DELETE FROM products;',
        'DELETE FROM categories;',
        'DELETE FROM system_settings;',
        'SET FOREIGN_KEY_CHECKS = 1;',
        '',
    ];

    const sectionChunks = [
        createSqlInsert(
            'categories',
            ['category_name', 'description'],
            dataset.categories.map((category) => ({
                category_name: category.name,
                description: category.description,
            }))
        ),
        createSqlInsert(
            'products',
            ['sku', 'product_name', 'description', 'category_id', 'unit_price', 'cost_price', 'current_stock', 'reorder_level', 'reorder_quantity', 'created_by'],
            productsForSql
        ),
        createSqlInsert(
            'transactions',
            ['product_id', 'transaction_type', 'quantity', 'unit_price', 'total_amount', 'reference_number', 'notes', 'transaction_date', 'created_by'],
            transactionsForSql
        ),
        createSqlInsert(
            'sales_data',
            ['product_id', 'sale_date', 'quantity_sold', 'revenue'],
            salesForSql
        ),
        createSqlInsert(
            'alerts',
            ['product_id', 'alert_type', 'message', 'severity', 'is_read', 'is_resolved'],
            alertsForSql
        ),
        createSqlInsert(
            'system_settings',
            ['setting_key', 'setting_value', 'description', 'updated_by'],
            dataset.settings.map(([setting_key, setting_value, description, updated_by]) => ({
                setting_key,
                setting_value,
                description,
                updated_by,
            }))
        ),
    ];

    sections.push(...sectionChunks);

    return sections.filter(Boolean).join('\n');
}

async function writeSqlSeedFile(dataset, options = {}) {
    const dbName = options.dbName || process.env.DB_NAME || 'inventory_management';
    const outputDirectory = options.outputDirectory || path.join(__dirname, '..', 'generated');
    const fileName = options.fileName || `sample-data.dynamic.${Date.now()}.sql`;

    fs.mkdirSync(outputDirectory, { recursive: true });
    const outputPath = path.join(outputDirectory, fileName);
    const content = buildSqlSeedFileContent(dataset, dbName);

    fs.writeFileSync(outputPath, content, 'utf8');

    return outputPath;
}

async function insertSeedData(connection, dataset) {
    await connection.query('DELETE FROM forecasts');
    await connection.query('DELETE FROM sales_data');
    await connection.query('DELETE FROM stock_history');
    await connection.query('DELETE FROM transactions');
    await connection.query('DELETE FROM alerts');
    await connection.query('DELETE FROM products');
    await connection.query('DELETE FROM categories');
    await connection.query('DELETE FROM system_settings');

    await connection.query(
        `INSERT INTO categories (category_name, description) VALUES ${dataset.categories
            .map(() => '(?, ?)')
            .join(', ')}`,
        dataset.categories.flatMap((category) => [category.name, category.description])
    );

    const [categoryRows] = await connection.query('SELECT category_id, category_name FROM categories');
    const categoryMap = new Map(categoryRows.map((row) => [row.category_name, row.category_id]));

    const productsForInsert = dataset.products.map((product) => ({
        ...product,
        category_id: categoryMap.get(product.categoryName),
    }));

    await connection.query(
        `INSERT INTO products (sku, product_name, description, category_id, unit_price, cost_price, current_stock, reorder_level, reorder_quantity, created_by)
         VALUES ${productsForInsert.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
        productsForInsert.flatMap((product) => [
            product.sku,
            product.product_name,
            product.description,
            product.category_id,
            product.unit_price,
            product.cost_price,
            product.current_stock,
            product.reorder_level,
            product.reorder_quantity,
            product.created_by,
        ])
    );

    const [productRows] = await connection.query('SELECT product_id, sku FROM products');
    const productBySku = new Map(productRows.map((row) => [row.sku, row.product_id]));

    const productIdListByIndex = dataset.products.map((product) => productBySku.get(product.sku));

    const transactionsForInsert = dataset.transactions.map((transaction) => ({
        ...transaction,
        product_id: productIdListByIndex[transaction.productIndex],
    }));

    if (transactionsForInsert.length > 0) {
        await connection.query(
            `INSERT INTO transactions (product_id, transaction_type, quantity, unit_price, total_amount, reference_number, notes, transaction_date, created_by)
             VALUES ${transactionsForInsert.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
            transactionsForInsert.flatMap((transaction) => [
                transaction.product_id,
                transaction.transaction_type,
                transaction.quantity,
                transaction.unit_price,
                transaction.total_amount,
                transaction.reference_number,
                transaction.notes,
                transaction.transaction_date,
                transaction.created_by,
            ])
        );
    }

    const salesForInsert = dataset.salesData.map((sale) => ({
        ...sale,
        product_id: productIdListByIndex[sale.productIndex],
    }));

    if (salesForInsert.length > 0) {
        await connection.query(
            `INSERT INTO sales_data (product_id, sale_date, quantity_sold, revenue)
             VALUES ${salesForInsert.map(() => '(?, ?, ?, ?)').join(', ')}`,
            salesForInsert.flatMap((sale) => [sale.product_id, sale.sale_date, sale.quantity_sold, sale.revenue])
        );
    }

    const alertsForInsert = dataset.alerts.map((alert) => ({
        ...alert,
        product_id: productIdListByIndex[alert.productIndex],
    }));

    if (alertsForInsert.length > 0) {
        await connection.query(
            `INSERT INTO alerts (product_id, alert_type, message, severity, is_read, is_resolved)
             VALUES ${alertsForInsert.map(() => '(?, ?, ?, ?, ?, ?)').join(', ')}`,
            alertsForInsert.flatMap((alert) => [
                alert.product_id,
                alert.alert_type,
                alert.message,
                alert.severity,
                alert.is_read,
                alert.is_resolved,
            ])
        );
    }

    await connection.query(
        `INSERT INTO system_settings (setting_key, setting_value, description, updated_by)
         VALUES ${dataset.settings.map(() => '(?, ?, ?, ?)').join(', ')}`,
        dataset.settings.flat()
    );

    return {
        categories: dataset.categories.length,
        products: dataset.products.length,
        transactions: dataset.transactions.length,
        salesData: dataset.salesData.length,
        alerts: dataset.alerts.length,
    };
}

async function seedDynamicSampleData(connection, options = {}) {
    const dataset = generateDynamicSeedDataset(options);
    const summary = await insertSeedData(connection, dataset);

    let sqlFilePath = null;
    if (options.exportSql !== false) {
        sqlFilePath = await writeSqlSeedFile(dataset, options);
    }

    return {
        summary,
        sqlFilePath,
        profile: options.profile || 'small',
    };
}

module.exports = {
    generateDynamicSeedDataset,
    writeSqlSeedFile,
    buildSqlSeedFileContent,
    seedDynamicSampleData,
};
