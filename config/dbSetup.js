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
const { seedDynamicSampleData } = require('./seedGenerator');

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

        // Step 6: Dynamic sample data insert karo
        const seedProfile = process.env.SEED_PROFILE || 'small';
        const shouldExportSql = process.env.SEED_EXPORT_SQL !== 'false';

        console.log(`📦 Inserting dynamic sample data (profile: ${seedProfile})...`);
        const seedResult = await seedDynamicSampleData(connection, {
            profile: seedProfile,
            exportSql: shouldExportSql,
        });

        console.log('✅ Dynamic sample data inserted successfully!');
        console.log(`📊 Seed summary: ${JSON.stringify(seedResult.summary)}`);
        if (seedResult.sqlFilePath) {
            console.log(`📄 SQL export created: ${seedResult.sqlFilePath}`);
        }
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
