-- ============================================================
-- SMART INVENTORY MANAGEMENT SYSTEM
-- Sample Data for Presentation / Demo
-- ============================================================
-- HOW TO USE:
--   1. Open MySQL Workbench (ya phpMyAdmin)
--   2. Select database: inventory_management
--   3. Run this entire file once
-- ============================================================

USE inventory_management;

-- ============================================================
-- STEP 1: USERS
-- ============================================================
-- Passwords:
--   admin@inventory.com   → admin123
--   manager@inventory.com → manager123
--   rahul@inventory.com   → staff123
--   priya@inventory.com   → staff123

INSERT INTO users (full_name, email, password_hash, role, phone, is_active) VALUES
('Nikita Dahiya',   'admin@inventory.com',   '$2b$10$otf1b.XJYX5q9I23rZoJSeM/diwuaDRqNrc9jK2cijNzgGE8wZB2S', 'admin',   '9876543210', TRUE),
('Rohan Sharma',    'manager@inventory.com', '$2b$10$tTEDMkERvwtIOfsus5NpTeTkTvIq9YEYj0X51Km6vQwk.4JWWk9Xy', 'manager', '9876543211', TRUE),
('Rahul Gupta',     'rahul@inventory.com',   '$2b$10$Dtv9jt0WKbPhUUiovTIAh.sXNbOF36FcafcgPZo0CdXTFiBd9PMwS', 'staff',   '9876543212', TRUE),
('Priya Mehta',     'priya@inventory.com',   '$2b$10$Dtv9jt0WKbPhUUiovTIAh.sXNbOF36FcafcgPZo0CdXTFiBd9PMwS', 'staff',   '9876543213', TRUE),
('Amit Verma',      'amit@inventory.com',    '$2b$10$Dtv9jt0WKbPhUUiovTIAh.sXNbOF36FcafcgPZo0CdXTFiBd9PMwS', 'staff',   '9876543214', FALSE);

-- ============================================================
-- STEP 2: CATEGORIES
-- ============================================================
INSERT INTO categories (category_name, description) VALUES
('Electronics',      'Laptops, mobiles, accessories'),
('Furniture',        'Office chairs, tables, shelves'),
('Stationery',       'Pens, notebooks, paper, files'),
('Food & Beverages', 'Packaged snacks and drinks'),
('Clothing',         'T-shirts, uniforms, accessories');

-- ============================================================
-- STEP 3: PRODUCTS  (12 products across 5 categories)
-- ============================================================
INSERT INTO products (sku, product_name, description, category_id, unit_price, cost_price, current_stock, reorder_level, reorder_quantity, created_by) VALUES
-- Electronics (category_id = 1)
('ELEC-001', 'Laptop HP 15',          'HP 15-inch laptop, 8GB RAM, 512GB SSD',      1, 55000.00, 45000.00, 12,  5, 10, 1),
('ELEC-002', 'Wireless Mouse Logitech','Logitech M185 wireless mouse, black',        1,  1200.00,   800.00, 45, 15, 30, 1),
('ELEC-003', 'USB-C Hub 7-in-1',      '7-port USB-C hub with HDMI and SD card',     1,  2500.00,  1800.00,  8, 10, 20, 1),
('ELEC-004', 'Mechanical Keyboard',   'Gaming mechanical keyboard, RGB backlit',    1,  3800.00,  2800.00, 20, 10, 15, 1),

-- Furniture (category_id = 2)
('FURN-001', 'Ergonomic Office Chair','Adjustable ergonomic chair with lumbar support', 2, 12000.00, 9000.00,  6,  3,  5, 1),
('FURN-002', 'Study Table 4x2ft',     'Wooden study table with drawer',             2,  6500.00,  4800.00,  3,  2,  5, 1),

-- Stationery (category_id = 3)
('STAT-001', 'A4 Paper Ream 500 sheets','Premium A4 size paper, 80 GSM',             3,   350.00,   250.00, 80, 30, 50, 2),
('STAT-002', 'Blue Ballpoint Pen Box', 'Box of 50 blue ballpoint pens',             3,   120.00,    75.00, 25, 20, 50, 2),
('STAT-003', 'Spiral Notebook A5',    'A5 spiral bound ruled notebook, 200 pages',  3,   180.00,   120.00,  4, 15, 30, 2),

-- Food & Beverages (category_id = 4)
('FOOD-001', 'Biscuit Pack Parle-G',  'Parle-G biscuits family pack 800g',          4,    45.00,    32.00, 150, 50, 100, 2),
('FOOD-002', 'Green Tea Box 25 bags', 'Organic green tea, 25 tea bags',             4,   220.00,   160.00, 18, 20,  40, 2),

-- Clothing (category_id = 5)
('CLTH-001', 'Staff T-Shirt (White)', 'White uniform T-shirt, 100% cotton',         5,   450.00,   300.00,  2, 10,  25, 1);

-- ============================================================
-- STEP 4: TRANSACTIONS (Past 3 Months — for Analytics graphs)
-- ============================================================

-- January 2026 — Stock IN (initial loading)
INSERT INTO transactions (product_id, transaction_type, quantity, unit_price, total_amount, reference_number, notes, transaction_date, created_by) VALUES
(1,  'in', 20, 45000.00, 900000.00, 'PO-JAN-001', 'Initial stock - Laptop HP 15',         '2026-01-03 10:00:00', 1),
(2,  'in', 80,   800.00,  64000.00, 'PO-JAN-002', 'Initial stock - Wireless Mouse',        '2026-01-03 10:30:00', 1),
(3,  'in', 25,  1800.00,  45000.00, 'PO-JAN-003', 'Initial stock - USB-C Hub',             '2026-01-04 09:00:00', 1),
(4,  'in', 30,  2800.00,  84000.00, 'PO-JAN-004', 'Initial stock - Mechanical Keyboard',   '2026-01-04 09:30:00', 1),
(7,  'in',120,   250.00,  30000.00, 'PO-JAN-005', 'Initial stock - A4 Paper',              '2026-01-05 11:00:00', 2),
(8,  'in', 75,    75.00,   5625.00, 'PO-JAN-006', 'Initial stock - Pen Box',               '2026-01-05 11:30:00', 2),
(10, 'in',200,    32.00,   6400.00, 'PO-JAN-007', 'Initial stock - Parle-G Biscuit',       '2026-01-06 10:00:00', 2),
(11, 'in', 50,   160.00,   8000.00, 'PO-JAN-008', 'Initial stock - Green Tea',             '2026-01-06 10:30:00', 2),
(5,  'in', 10,  9000.00,  90000.00, 'PO-JAN-009', 'Initial stock - Ergonomic Chair',       '2026-01-07 09:00:00', 1),
(9,  'in', 40,   120.00,   4800.00, 'PO-JAN-010', 'Initial stock - Spiral Notebook',       '2026-01-07 09:30:00', 2),
(12, 'in', 30,   300.00,   9000.00, 'PO-JAN-011', 'Initial stock - Staff T-Shirt',         '2026-01-08 10:00:00', 1),
(6,  'in',  8,  4800.00,  38400.00, 'PO-JAN-012', 'Initial stock - Study Table',           '2026-01-08 11:00:00', 1);

-- January 2026 — Sales OUT
INSERT INTO transactions (product_id, transaction_type, quantity, unit_price, total_amount, reference_number, notes, transaction_date, created_by) VALUES
(2,  'out',  8, 1200.00,  9600.00, 'INV-JAN-001', 'Sale - Wireless Mouse',       '2026-01-10 14:00:00', 3),
(7,  'out', 20,  350.00,  7000.00, 'INV-JAN-002', 'Sale - A4 Paper',             '2026-01-12 11:00:00', 3),
(10, 'out', 40,   45.00,  1800.00, 'INV-JAN-003', 'Sale - Parle-G Biscuit',      '2026-01-14 10:00:00', 4),
(1,  'out',  3,55000.00,165000.00, 'INV-JAN-004', 'Sale - Laptop HP 15',         '2026-01-15 16:00:00', 3),
(8,  'out', 15,  120.00,  1800.00, 'INV-JAN-005', 'Sale - Pen Box',              '2026-01-17 09:30:00', 4),
(11, 'out', 12,  220.00,  2640.00, 'INV-JAN-006', 'Sale - Green Tea',            '2026-01-18 15:00:00', 3),
(4,  'out',  5, 3800.00, 19000.00, 'INV-JAN-007', 'Sale - Mechanical Keyboard',  '2026-01-20 13:00:00', 3),
(9,  'out', 15,  180.00,  2700.00, 'INV-JAN-008', 'Sale - Spiral Notebook',      '2026-01-22 10:00:00', 4),
(5,  'out',  2,12000.00, 24000.00, 'INV-JAN-009', 'Sale - Ergonomic Chair',      '2026-01-25 14:30:00', 3),
(12, 'out', 10,  450.00,  4500.00, 'INV-JAN-010', 'Sale - Staff T-Shirt',        '2026-01-28 11:00:00', 4);

-- February 2026 — Restock IN
INSERT INTO transactions (product_id, transaction_type, quantity, unit_price, total_amount, reference_number, notes, transaction_date, created_by) VALUES
(2,  'in', 30,  800.00,  24000.00, 'PO-FEB-001', 'Restock - Wireless Mouse',     '2026-02-03 09:00:00', 1),
(10, 'in', 80,   32.00,   2560.00, 'PO-FEB-002', 'Restock - Parle-G Biscuit',    '2026-02-04 10:00:00', 2),
(7,  'in', 50,  250.00,  12500.00, 'PO-FEB-003', 'Restock - A4 Paper',           '2026-02-05 11:00:00', 2),
(9,  'in', 30,  120.00,   3600.00, 'PO-FEB-004', 'Restock - Spiral Notebook',    '2026-02-05 11:30:00', 2),
(12, 'in', 20,  300.00,   6000.00, 'PO-FEB-005', 'Restock - Staff T-Shirt',      '2026-02-06 09:00:00', 1);

-- February 2026 — Sales OUT
INSERT INTO transactions (product_id, transaction_type, quantity, unit_price, total_amount, reference_number, notes, transaction_date, created_by) VALUES
(1,  'out',  4,55000.00,220000.00, 'INV-FEB-001', 'Sale - Laptop HP 15',         '2026-02-05 15:00:00', 3),
(2,  'out', 12, 1200.00,  14400.00,'INV-FEB-002', 'Sale - Wireless Mouse',       '2026-02-07 10:00:00', 4),
(4,  'out',  4, 3800.00,  15200.00,'INV-FEB-003', 'Sale - Mechanical Keyboard',  '2026-02-10 14:00:00', 3),
(7,  'out', 25,  350.00,   8750.00,'INV-FEB-004', 'Sale - A4 Paper',             '2026-02-12 11:00:00', 4),
(10, 'out', 55,   45.00,   2475.00,'INV-FEB-005', 'Sale - Parle-G Biscuit',      '2026-02-14 09:30:00', 3),
(11, 'out',  8,  220.00,   1760.00,'INV-FEB-006', 'Sale - Green Tea',            '2026-02-15 16:00:00', 4),
(9,  'out', 18,  180.00,   3240.00,'INV-FEB-007', 'Sale - Spiral Notebook',      '2026-02-18 13:00:00', 3),
(8,  'out', 20,  120.00,   2400.00,'INV-FEB-008', 'Sale - Pen Box',              '2026-02-20 10:00:00', 4),
(5,  'out',  2,12000.00,  24000.00,'INV-FEB-009', 'Sale - Ergonomic Chair',      '2026-02-22 15:00:00', 3),
(3,  'out',  8, 2500.00,  20000.00,'INV-FEB-010', 'Sale - USB-C Hub',            '2026-02-25 14:00:00', 3),
(6,  'out',  3, 6500.00,  19500.00,'INV-FEB-011', 'Sale - Study Table',          '2026-02-26 11:00:00', 3),
(12, 'out', 12,  450.00,   5400.00,'INV-FEB-012', 'Sale - Staff T-Shirt',        '2026-02-28 09:00:00', 4);

-- March 2026 — Restock IN
INSERT INTO transactions (product_id, transaction_type, quantity, unit_price, total_amount, reference_number, notes, transaction_date, created_by) VALUES
(1,  'in',  8,45000.00, 360000.00, 'PO-MAR-001', 'Restock - Laptop HP 15',      '2026-03-01 09:00:00', 1),
(3,  'in', 15, 1800.00,  27000.00, 'PO-MAR-002', 'Restock - USB-C Hub',         '2026-03-02 10:00:00', 1),
(11, 'in', 30,  160.00,   4800.00, 'PO-MAR-003', 'Restock - Green Tea',         '2026-03-03 11:00:00', 2),
(8,  'in', 40,   75.00,   3000.00, 'PO-MAR-004', 'Restock - Pen Box',           '2026-03-04 09:30:00', 2);

-- March 2026 — Sales OUT
INSERT INTO transactions (product_id, transaction_type, quantity, unit_price, total_amount, reference_number, notes, transaction_date, created_by) VALUES
(1,  'out',  5,55000.00,275000.00, 'INV-MAR-001', 'Sale - Laptop HP 15',        '2026-03-05 14:00:00', 3),
(2,  'out', 10, 1200.00,  12000.00,'INV-MAR-002', 'Sale - Wireless Mouse',      '2026-03-07 11:00:00', 4),
(4,  'out',  5, 3800.00,  19000.00,'INV-MAR-003', 'Sale - Mechanical Keyboard', '2026-03-10 15:00:00', 3),
(7,  'out', 15,  350.00,   5250.00,'INV-MAR-004', 'Sale - A4 Paper',            '2026-03-12 10:00:00', 4),
(10, 'out', 35,   45.00,   1575.00,'INV-MAR-005', 'Sale - Parle-G Biscuit',     '2026-03-14 09:00:00', 3),
(11, 'out', 14,  220.00,   3080.00,'INV-MAR-006', 'Sale - Green Tea',           '2026-03-15 16:30:00', 4),
(9,  'out', 15,  180.00,   2700.00,'INV-MAR-007', 'Sale - Spiral Notebook',     '2026-03-18 13:00:00', 3),
(3,  'out',  9, 2500.00,  22500.00,'INV-MAR-008', 'Sale - USB-C Hub',           '2026-03-20 14:00:00', 3),
(8,  'out', 22,  120.00,   2640.00,'INV-MAR-009', 'Sale - Pen Box',             '2026-03-22 10:00:00', 4),
(5,  'out',  2,12000.00,  24000.00,'INV-MAR-010', 'Sale - Ergonomic Chair',     '2026-03-25 15:00:00', 3),
(12, 'out', 16,  450.00,   7200.00,'INV-MAR-011', 'Sale - Staff T-Shirt',       '2026-03-26 11:00:00', 4);

-- ============================================================
-- STEP 5: SALES DATA (For ML Forecasting in Phase 3)
-- ============================================================
INSERT INTO sales_data (product_id, sale_date, quantity_sold, revenue) VALUES
-- Laptop HP 15 (high value, slow moving)
(1, '2026-01-15', 3, 165000.00),
(1, '2026-02-05', 4, 220000.00),
(1, '2026-03-05', 5, 275000.00),
-- Wireless Mouse (moderate, steady)
(2, '2026-01-10', 8, 9600.00),
(2, '2026-02-07',12, 14400.00),
(2, '2026-03-07',10, 12000.00),
-- Parle-G (fast moving, daily)
(10,'2026-01-14',40,  1800.00),
(10,'2026-02-14',55,  2475.00),
(10,'2026-03-14',35,  1575.00),
-- Green Tea (moderate)
(11,'2026-01-18',12,  2640.00),
(11,'2026-02-15', 8,  1760.00),
(11,'2026-03-15',14,  3080.00),
-- A4 Paper (bulk, regular)
(7, '2026-01-12',20,  7000.00),
(7, '2026-02-12',25,  8750.00),
(7, '2026-03-12',15,  5250.00);

-- ============================================================
-- STEP 6: ALERTS (Low stock warnings — for Alerts tab)
-- ============================================================
INSERT INTO alerts (product_id, alert_type, message, severity, is_read, is_resolved) VALUES
(9,  'low_stock',    'Spiral Notebook A5 is running low — only 4 units left (reorder level: 15)',      'high',     FALSE, FALSE),
(3,  'low_stock',    'USB-C Hub 7-in-1 stock is critically low — only 8 units (reorder level: 10)',   'critical', FALSE, FALSE),
(6,  'low_stock',    'Study Table 4x2ft is low — only 3 units remaining (reorder level: 2)',          'medium',   TRUE,  FALSE),
(5,  'low_stock',    'Ergonomic Office Chair is running low — 6 units left (reorder level: 3)',       'medium',   FALSE, FALSE),
(12, 'reorder_point','Staff T-Shirt (White) has reached reorder point — 2 units left',               'critical', FALSE, FALSE);

-- ============================================================
-- STEP 7: SYSTEM SETTINGS
-- ============================================================
INSERT INTO system_settings (setting_key, setting_value, description, updated_by) VALUES
('low_stock_threshold',  '10',   'Minimum stock before low-stock alert fires',    1),
('forecast_days',        '30',   'Number of days to generate demand forecast for', 1),
('email_notifications',  'true', 'Send email alerts for low stock',               1),
('auto_reorder',         'false','Automatically raise purchase orders on reorder', 1),
('currency',             'INR',  'Currency used in the system',                   1),
('company_name',         'Smart Inventory Pvt Ltd', 'Company display name',       1);

-- ============================================================
-- VERIFY: Check counts (run this to confirm data loaded)
-- ============================================================
SELECT 'users'        AS table_name, COUNT(*) AS total_rows FROM users
UNION ALL
SELECT 'categories',  COUNT(*) FROM categories
UNION ALL
SELECT 'products',    COUNT(*) FROM products
UNION ALL
SELECT 'transactions',COUNT(*) FROM transactions
UNION ALL
SELECT 'sales_data',  COUNT(*) FROM sales_data
UNION ALL
SELECT 'alerts',      COUNT(*) FROM alerts
UNION ALL
SELECT 'system_settings', COUNT(*) FROM system_settings;
