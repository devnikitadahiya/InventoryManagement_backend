// ============================================================
// DATABASE AUTO-SETUP
// Ye file backend start hote hi chalti hai.
// Kya karti hai:
//   1. Database exist nahi karta to create karti hai
//   2. Tables exist nahi karte to create karti hai
//   3. Sample data nahi hai to automatically insert karti hai
// ============================================================

const mysql = require('mysql2/promise');
require('dotenv').config();

const DEMO_USERS = [
    {
        full_name: 'Nikita Dahiya',
        email: 'admin@inventory.com',
        password_hash: '$2b$10$otf1b.XJYX5q9I23rZoJSeM/diwuaDRqNrc9jK2cijNzgGE8wZB2S',
        role: 'admin',
        phone: '9876543210',
        is_active: true,
    },
    {
        full_name: 'Rohan Sharma',
        email: 'manager@inventory.com',
        password_hash: '$2b$10$tTEDMkERvwtIOfsus5NpTeTkTvIq9YEYj0X51Km6vQwk.4JWWk9Xy',
        role: 'manager',
        phone: '9876543211',
        is_active: true,
    },
    {
        full_name: 'Rahul Gupta',
        email: 'rahul@inventory.com',
        password_hash: '$2b$10$Dtv9jt0WKbPhUUiovTIAh.sXNbOF36FcafcgPZo0CdXTFiBd9PMwS',
        role: 'staff',
        phone: '9876543212',
        is_active: true,
    },
    {
        full_name: 'Priya Mehta',
        email: 'priya@inventory.com',
        password_hash: '$2b$10$Dtv9jt0WKbPhUUiovTIAh.sXNbOF36FcafcgPZo0CdXTFiBd9PMwS',
        role: 'staff',
        phone: '9876543213',
        is_active: true,
    },
    {
        full_name: 'Amit Verma',
        email: 'amit@inventory.com',
        password_hash: '$2b$10$Dtv9jt0WKbPhUUiovTIAh.sXNbOF36FcafcgPZo0CdXTFiBd9PMwS',
        role: 'staff',
        phone: '9876543214',
        is_active: false,
    },
];

async function ensureDemoUsers(connection) {
    for (const demoUser of DEMO_USERS) {
        const [rows] = await connection.query(
            'SELECT user_id FROM users WHERE email = ?',
            [demoUser.email]
        );

        if (rows.length > 0) {
            await connection.query(
                `UPDATE users
                 SET full_name = ?, password_hash = ?, role = ?, phone = ?, is_active = ?
                 WHERE email = ?`,
                [
                    demoUser.full_name,
                    demoUser.password_hash,
                    demoUser.role,
                    demoUser.phone,
                    demoUser.is_active,
                    demoUser.email,
                ]
            );
            continue;
        }

        await connection.query(
            `INSERT INTO users (full_name, email, password_hash, role, phone, is_active)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                demoUser.full_name,
                demoUser.email,
                demoUser.password_hash,
                demoUser.role,
                demoUser.phone,
                demoUser.is_active,
            ]
        );
    }
}

async function setupDatabase() {
    let connection;

    try {
        // Step 1: Pehle BINA database ke connect karo
        // (kyunki database abhi exist hi nahi karta hoga)
        connection = await mysql.createConnection({
            host:     process.env.DB_HOST     || 'localhost',
            user:     process.env.DB_USER     || 'root',
            password: process.env.DB_PASSWORD || '',
            port:     process.env.DB_PORT     || 3306,
        });

        const dbName = process.env.DB_NAME || 'inventory_management';

        // Step 2: Database create karo (agar pehle se nahi hai to)
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
        await connection.query(`USE \`${dbName}\``);
        console.log(`✅ Database "${dbName}" ready`);

        // Step 3: Sari tables create karo (IF NOT EXISTS — safe hai, dobara nahi banegi)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                user_id       INT PRIMARY KEY AUTO_INCREMENT,
                full_name     VARCHAR(100) NOT NULL,
                email         VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role          ENUM('admin','manager','staff') DEFAULT 'staff',
                phone         VARCHAR(20),
                is_active     BOOLEAN DEFAULT TRUE,
                created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                last_login    TIMESTAMP NULL,
                INDEX idx_email (email),
                INDEX idx_role  (role)
            )
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS categories (
                category_id   INT PRIMARY KEY AUTO_INCREMENT,
                category_name VARCHAR(100) NOT NULL UNIQUE,
                description   TEXT,
                created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_category_name (category_name)
            )
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS products (
                product_id       INT PRIMARY KEY AUTO_INCREMENT,
                sku              VARCHAR(50)  UNIQUE NOT NULL,
                product_name     VARCHAR(200) NOT NULL,
                description      TEXT,
                category_id      INT,
                unit_price       DECIMAL(10,2) NOT NULL,
                cost_price       DECIMAL(10,2),
                current_stock    INT DEFAULT 0,
                reorder_level    INT DEFAULT 10,
                reorder_quantity INT DEFAULT 50,
                unit_of_measure  VARCHAR(20) DEFAULT 'pieces',
                is_active        BOOLEAN DEFAULT TRUE,
                created_by       INT,
                created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE SET NULL,
                FOREIGN KEY (created_by)  REFERENCES users(user_id)          ON DELETE SET NULL,
                INDEX idx_sku          (sku),
                INDEX idx_product_name (product_name),
                INDEX idx_category     (category_id),
                INDEX idx_current_stock(current_stock)
            )
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS transactions (
                transaction_id   INT PRIMARY KEY AUTO_INCREMENT,
                product_id       INT NOT NULL,
                transaction_type ENUM('in','out','adjustment') NOT NULL,
                quantity         INT NOT NULL,
                unit_price       DECIMAL(10,2),
                total_amount     DECIMAL(10,2),
                reference_number VARCHAR(50),
                notes            TEXT,
                transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_by       INT,
                FOREIGN KEY (product_id)  REFERENCES products(product_id) ON DELETE CASCADE,
                FOREIGN KEY (created_by)  REFERENCES users(user_id)       ON DELETE SET NULL,
                INDEX idx_product          (product_id),
                INDEX idx_transaction_type (transaction_type),
                INDEX idx_transaction_date (transaction_date)
            )
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS stock_history (
                history_id    INT PRIMARY KEY AUTO_INCREMENT,
                product_id    INT NOT NULL,
                date          DATE NOT NULL,
                opening_stock INT,
                closing_stock INT,
                stock_in      INT DEFAULT 0,
                stock_out     INT DEFAULT 0,
                created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
                UNIQUE KEY unique_product_date (product_id, date),
                INDEX idx_product_date (product_id, date)
            )
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS sales_data (
                sales_id      INT PRIMARY KEY AUTO_INCREMENT,
                product_id    INT NOT NULL,
                sale_date     DATE NOT NULL,
                quantity_sold INT NOT NULL,
                revenue       DECIMAL(10,2),
                created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
                INDEX idx_product_date (product_id, sale_date),
                INDEX idx_sale_date    (sale_date)
            )
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS forecasts (
                forecast_id      INT PRIMARY KEY AUTO_INCREMENT,
                product_id       INT NOT NULL,
                forecast_date    DATE NOT NULL,
                predicted_demand DECIMAL(10,2),
                confidence_lower DECIMAL(10,2),
                confidence_upper DECIMAL(10,2),
                model_accuracy   DECIMAL(5,2),
                generated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
                INDEX idx_product_forecast_date (product_id, forecast_date)
            )
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS alerts (
                alert_id    INT PRIMARY KEY AUTO_INCREMENT,
                product_id  INT,
                alert_type  ENUM('low_stock','predicted_stockout','overstock','reorder_point') NOT NULL,
                message     TEXT NOT NULL,
                severity    ENUM('low','medium','high','critical') DEFAULT 'medium',
                is_read     BOOLEAN DEFAULT FALSE,
                is_resolved BOOLEAN DEFAULT FALSE,
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                resolved_at TIMESTAMP NULL,
                resolved_by INT,
                FOREIGN KEY (product_id)  REFERENCES products(product_id) ON DELETE CASCADE,
                FOREIGN KEY (resolved_by) REFERENCES users(user_id)       ON DELETE SET NULL,
                INDEX idx_alert_type (alert_type),
                INDEX idx_is_read    (is_read),
                INDEX idx_created_at (created_at)
            )
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS system_settings (
                setting_id    INT PRIMARY KEY AUTO_INCREMENT,
                setting_key   VARCHAR(100) UNIQUE NOT NULL,
                setting_value TEXT,
                description   TEXT,
                updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                updated_by    INT,
                FOREIGN KEY (updated_by) REFERENCES users(user_id) ON DELETE SET NULL
            )
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                log_id     INT PRIMARY KEY AUTO_INCREMENT,
                user_id    INT,
                action     VARCHAR(100) NOT NULL,
                table_name VARCHAR(50),
                record_id  INT,
                old_values TEXT,
                new_values TEXT,
                ip_address VARCHAR(45),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
                INDEX idx_user       (user_id),
                INDEX idx_action     (action),
                INDEX idx_created_at (created_at)
            )
        `);

        console.log('✅ All tables ready');

        // Step 4: Demo login accounts ko hamesha valid rakho
        await ensureDemoUsers(connection);
        console.log('✅ Demo user accounts ready');

        // Step 5: Sample data check — agar products pehle se hain to heavy seed skip karo
        const [[{ count }]] = await connection.query('SELECT COUNT(*) AS count FROM products');

        if (count > 0) {
            console.log(`✅ Product sample data already present (${count} products found) — skipping bulk seed`);
            return;
        }

        // Step 6: Sample data insert karo
        console.log('📦 Inserting sample data...');

        // Categories
        await connection.query(`
            INSERT INTO categories (category_name, description) VALUES
            ('Electronics',      'Laptops, mobiles, accessories'),
            ('Furniture',        'Office chairs, tables, shelves'),
            ('Stationery',       'Pens, notebooks, paper, files'),
            ('Food & Beverages', 'Packaged snacks and drinks'),
            ('Clothing',         'T-shirts, uniforms, accessories')
        `);

        // Products
        await connection.query(`
            INSERT INTO products (sku, product_name, description, category_id, unit_price, cost_price, current_stock, reorder_level, reorder_quantity, created_by) VALUES
            ('ELEC-001','Laptop HP 15',           'HP 15-inch laptop, 8GB RAM, 512GB SSD',         1, 55000.00, 45000.00, 12,  5, 10, 1),
            ('ELEC-002','Wireless Mouse Logitech','Logitech M185 wireless mouse, black',            1,  1200.00,   800.00, 45, 15, 30, 1),
            ('ELEC-003','USB-C Hub 7-in-1',       '7-port USB-C hub with HDMI and SD card',        1,  2500.00,  1800.00,  8, 10, 20, 1),
            ('ELEC-004','Mechanical Keyboard',    'Gaming mechanical keyboard, RGB backlit',       1,  3800.00,  2800.00, 20, 10, 15, 1),
            ('FURN-001','Ergonomic Office Chair', 'Adjustable ergonomic chair with lumbar support',2, 12000.00,  9000.00,  6,  3,  5, 1),
            ('FURN-002','Study Table 4x2ft',      'Wooden study table with drawer',                2,  6500.00,  4800.00,  3,  2,  5, 1),
            ('STAT-001','A4 Paper Ream 500 sheets','Premium A4 size paper, 80 GSM',                3,   350.00,   250.00, 80, 30, 50, 2),
            ('STAT-002','Blue Ballpoint Pen Box', 'Box of 50 blue ballpoint pens',                 3,   120.00,    75.00, 25, 20, 50, 2),
            ('STAT-003','Spiral Notebook A5',     'A5 spiral bound ruled notebook, 200 pages',    3,   180.00,   120.00,  4, 15, 30, 2),
            ('FOOD-001','Biscuit Pack Parle-G',   'Parle-G biscuits family pack 800g',             4,    45.00,    32.00,150, 50,100, 2),
            ('FOOD-002','Green Tea Box 25 bags',  'Organic green tea, 25 tea bags',                4,   220.00,   160.00, 18, 20, 40, 2),
            ('CLTH-001','Staff T-Shirt (White)',  'White uniform T-shirt, 100% cotton',            5,   450.00,   300.00,  2, 10, 25, 1)
        `);

        // Transactions — 3 months (Jan/Feb/Mar 2026)
        await connection.query(`
            INSERT INTO transactions (product_id, transaction_type, quantity, unit_price, total_amount, reference_number, notes, transaction_date, created_by) VALUES
            (1, 'in', 20,45000,900000,'PO-JAN-001','Initial stock - Laptop',         '2026-01-03 10:00:00',1),
            (2, 'in', 80,  800, 64000,'PO-JAN-002','Initial stock - Mouse',          '2026-01-03 10:30:00',1),
            (3, 'in', 25, 1800, 45000,'PO-JAN-003','Initial stock - USB-C Hub',      '2026-01-04 09:00:00',1),
            (4, 'in', 30, 2800, 84000,'PO-JAN-004','Initial stock - Keyboard',       '2026-01-04 09:30:00',1),
            (7, 'in',120,  250, 30000,'PO-JAN-005','Initial stock - A4 Paper',       '2026-01-05 11:00:00',2),
            (8, 'in', 75,   75,  5625,'PO-JAN-006','Initial stock - Pen Box',        '2026-01-05 11:30:00',2),
            (10,'in',200,   32,  6400,'PO-JAN-007','Initial stock - Parle-G',        '2026-01-06 10:00:00',2),
            (11,'in', 50,  160,  8000,'PO-JAN-008','Initial stock - Green Tea',      '2026-01-06 10:30:00',2),
            (5, 'in', 10, 9000, 90000,'PO-JAN-009','Initial stock - Chair',          '2026-01-07 09:00:00',1),
            (9, 'in', 40,  120,  4800,'PO-JAN-010','Initial stock - Notebook',       '2026-01-07 09:30:00',2),
            (12,'in', 30,  300,  9000,'PO-JAN-011','Initial stock - T-Shirt',        '2026-01-08 10:00:00',1),
            (6, 'in',  8, 4800, 38400,'PO-JAN-012','Initial stock - Study Table',    '2026-01-08 11:00:00',1),
            (2, 'out', 8, 1200,  9600,'INV-JAN-001','Sale - Mouse',                  '2026-01-10 14:00:00',3),
            (7, 'out',20,  350,  7000,'INV-JAN-002','Sale - A4 Paper',               '2026-01-12 11:00:00',3),
            (10,'out',40,   45,  1800,'INV-JAN-003','Sale - Parle-G',                '2026-01-14 10:00:00',4),
            (1, 'out', 3,55000,165000,'INV-JAN-004','Sale - Laptop',                 '2026-01-15 16:00:00',3),
            (8, 'out',15,  120,  1800,'INV-JAN-005','Sale - Pen Box',                '2026-01-17 09:30:00',4),
            (11,'out',12,  220,  2640,'INV-JAN-006','Sale - Green Tea',              '2026-01-18 15:00:00',3),
            (4, 'out', 5, 3800, 19000,'INV-JAN-007','Sale - Keyboard',              '2026-01-20 13:00:00',3),
            (9, 'out',15,  180,  2700,'INV-JAN-008','Sale - Notebook',               '2026-01-22 10:00:00',4),
            (5, 'out', 2,12000, 24000,'INV-JAN-009','Sale - Chair',                  '2026-01-25 14:30:00',3),
            (12,'out',10,  450,  4500,'INV-JAN-010','Sale - T-Shirt',                '2026-01-28 11:00:00',4),
            (2, 'in', 30,  800, 24000,'PO-FEB-001','Restock - Mouse',               '2026-02-03 09:00:00',1),
            (10,'in', 80,   32,  2560,'PO-FEB-002','Restock - Parle-G',             '2026-02-04 10:00:00',2),
            (7, 'in', 50,  250, 12500,'PO-FEB-003','Restock - A4 Paper',            '2026-02-05 11:00:00',2),
            (9, 'in', 30,  120,  3600,'PO-FEB-004','Restock - Notebook',            '2026-02-05 11:30:00',2),
            (12,'in', 20,  300,  6000,'PO-FEB-005','Restock - T-Shirt',             '2026-02-06 09:00:00',1),
            (1, 'out', 4,55000,220000,'INV-FEB-001','Sale - Laptop',                '2026-02-05 15:00:00',3),
            (2, 'out',12, 1200, 14400,'INV-FEB-002','Sale - Mouse',                 '2026-02-07 10:00:00',4),
            (4, 'out', 4, 3800, 15200,'INV-FEB-003','Sale - Keyboard',             '2026-02-10 14:00:00',3),
            (7, 'out',25,  350,  8750,'INV-FEB-004','Sale - A4 Paper',              '2026-02-12 11:00:00',4),
            (10,'out',55,   45,  2475,'INV-FEB-005','Sale - Parle-G',               '2026-02-14 09:30:00',3),
            (11,'out', 8,  220,  1760,'INV-FEB-006','Sale - Green Tea',             '2026-02-15 16:00:00',4),
            (9, 'out',18,  180,  3240,'INV-FEB-007','Sale - Notebook',              '2026-02-18 13:00:00',3),
            (8, 'out',20,  120,  2400,'INV-FEB-008','Sale - Pen Box',               '2026-02-20 10:00:00',4),
            (5, 'out', 2,12000, 24000,'INV-FEB-009','Sale - Chair',                 '2026-02-22 15:00:00',3),
            (3, 'out', 8, 2500, 20000,'INV-FEB-010','Sale - USB-C Hub',             '2026-02-25 14:00:00',3),
            (6, 'out', 3, 6500, 19500,'INV-FEB-011','Sale - Study Table',           '2026-02-26 11:00:00',3),
            (12,'out',12,  450,  5400,'INV-FEB-012','Sale - T-Shirt',               '2026-02-28 09:00:00',4),
            (1, 'in',  8,45000,360000,'PO-MAR-001','Restock - Laptop',              '2026-03-01 09:00:00',1),
            (3, 'in', 15, 1800, 27000,'PO-MAR-002','Restock - USB-C Hub',           '2026-03-02 10:00:00',1),
            (11,'in', 30,  160,  4800,'PO-MAR-003','Restock - Green Tea',           '2026-03-03 11:00:00',2),
            (8, 'in', 40,   75,  3000,'PO-MAR-004','Restock - Pen Box',             '2026-03-04 09:30:00',2),
            (1, 'out', 5,55000,275000,'INV-MAR-001','Sale - Laptop',                '2026-03-05 14:00:00',3),
            (2, 'out',10, 1200, 12000,'INV-MAR-002','Sale - Mouse',                 '2026-03-07 11:00:00',4),
            (4, 'out', 5, 3800, 19000,'INV-MAR-003','Sale - Keyboard',             '2026-03-10 15:00:00',3),
            (7, 'out',15,  350,  5250,'INV-MAR-004','Sale - A4 Paper',              '2026-03-12 10:00:00',4),
            (10,'out',35,   45,  1575,'INV-MAR-005','Sale - Parle-G',               '2026-03-14 09:00:00',3),
            (11,'out',14,  220,  3080,'INV-MAR-006','Sale - Green Tea',             '2026-03-15 16:30:00',4),
            (9, 'out',15,  180,  2700,'INV-MAR-007','Sale - Notebook',              '2026-03-18 13:00:00',3),
            (3, 'out', 9, 2500, 22500,'INV-MAR-008','Sale - USB-C Hub',             '2026-03-20 14:00:00',3),
            (8, 'out',22,  120,  2640,'INV-MAR-009','Sale - Pen Box',               '2026-03-22 10:00:00',4),
            (5, 'out', 2,12000, 24000,'INV-MAR-010','Sale - Chair',                 '2026-03-25 15:00:00',3),
            (12,'out',16,  450,  7200,'INV-MAR-011','Sale - T-Shirt',               '2026-03-26 11:00:00',4)
        `);

        // Sales data (for ML forecasting later)
        await connection.query(`
            INSERT INTO sales_data (product_id, sale_date, quantity_sold, revenue) VALUES
            (1, '2026-01-15', 3, 165000),(1, '2026-02-05', 4, 220000),(1, '2026-03-05', 5, 275000),
            (2, '2026-01-10', 8,   9600),(2, '2026-02-07',12,  14400),(2, '2026-03-07',10,  12000),
            (10,'2026-01-14',40,   1800),(10,'2026-02-14',55,   2475),(10,'2026-03-14',35,   1575),
            (11,'2026-01-18',12,   2640),(11,'2026-02-15', 8,   1760),(11,'2026-03-15',14,   3080),
            (7, '2026-01-12',20,   7000),(7, '2026-02-12',25,   8750),(7, '2026-03-12',15,   5250)
        `);

        // Alerts (low stock warnings)
        await connection.query(`
            INSERT INTO alerts (product_id, alert_type, message, severity, is_read, is_resolved) VALUES
            (9,  'low_stock',    'Spiral Notebook A5 is running low — only 4 units left (reorder: 15)',      'high',     FALSE, FALSE),
            (3,  'low_stock',    'USB-C Hub stock is critically low — only 8 units left (reorder: 10)',      'critical', FALSE, FALSE),
            (6,  'low_stock',    'Study Table is low — only 3 units remaining (reorder: 2)',                 'medium',   TRUE,  FALSE),
            (5,  'low_stock',    'Ergonomic Chair is running low — 6 units left (reorder: 3)',               'medium',   FALSE, FALSE),
            (12, 'reorder_point','Staff T-Shirt (White) has reached reorder point — only 2 units left',     'critical', FALSE, FALSE)
        `);

        // System settings
        await connection.query(`
            INSERT INTO system_settings (setting_key, setting_value, description, updated_by) VALUES
            ('low_stock_threshold', '10',                    'Minimum stock before alert fires',          1),
            ('forecast_days',       '30',                    'Days to forecast demand for',               1),
            ('email_notifications', 'true',                  'Send email alerts for low stock',           1),
            ('auto_reorder',        'false',                 'Auto raise purchase orders on reorder',     1),
            ('currency',            'INR',                   'Currency used in the system',               1),
            ('company_name',        'Smart Inventory Pvt Ltd','Company display name',                     1)
        `);

        console.log('✅ Sample data inserted successfully!');
        console.log('');
        console.log('📋 Demo Login Credentials:');
        console.log('   Admin:   admin@inventory.com   / admin123');
        console.log('   Manager: manager@inventory.com / manager123');
        console.log('   Staff:   rahul@inventory.com   / staff123');

    } catch (error) {
        console.error('❌ Database setup failed:', error.message);
        // Server band nahi karo — sirf warn karo
        // (kyunki tables already exist hoti hain to koi problem nahi)
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

module.exports = setupDatabase;
