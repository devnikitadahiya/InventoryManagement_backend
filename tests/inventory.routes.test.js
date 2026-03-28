jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const app = require('../server');

const getToken = () =>
  jwt.sign({ id: 1, email: 'manager@inventory.com', role: 'manager' }, process.env.JWT_SECRET, { expiresIn: '1h' });

describe('Inventory routes', () => {
  test('GET /api/inventory/status should return summary and items', async () => {
    db.query
      .mockResolvedValueOnce([[{
        total_products: 10,
        out_of_stock_items: 1,
        low_stock_items: 3,
        in_stock_items: 6,
        total_stock_units: 300,
        total_inventory_value: 150000,
      }]])
      .mockResolvedValueOnce([[
        {
          product_id: 1,
          sku: 'SKU001',
          product_name: 'Laptop',
          current_stock: 5,
          reorder_level: 10,
          stock_status: 'low_stock',
        },
      ]]);

    const response = await request(app)
      .get('/api/inventory/status')
      .set('Authorization', `Bearer ${getToken()}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.summary.total_products).toBe(10);
    expect(response.body.data.items).toHaveLength(1);
  });

  test('GET /api/inventory/history/:id should validate product id', async () => {
    const response = await request(app)
      .get('/api/inventory/history/abc')
      .set('Authorization', `Bearer ${getToken()}`);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });
});
