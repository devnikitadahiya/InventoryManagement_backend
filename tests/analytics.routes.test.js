jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const app = require('../server');

const getToken = () =>
  jwt.sign({ id: 1, email: 'admin@inventory.com', role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });

describe('Analytics routes', () => {
  test('GET /api/analytics/dashboard should return dashboard stats', async () => {
    db.query
      .mockResolvedValueOnce([[{ total_products: 5, out_of_stock_items: 1, low_stock_items: 2, total_stock_value: 10000 }]])
      .mockResolvedValueOnce([[{ recent_sales_value: 5000, recent_sales_transactions: 4 }]])
      .mockResolvedValueOnce([[{ product_id: 1, sku: 'SKU001', product_name: 'Laptop', quantity_sold: 20, revenue: 20000 }]]);

    const response = await request(app)
      .get('/api/analytics/dashboard')
      .set('Authorization', `Bearer ${getToken()}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.total_products).toBe(5);
  });

  test('GET /api/analytics/sales-trends should reject invalid period', async () => {
    const response = await request(app)
      .get('/api/analytics/sales-trends?period=invalid')
      .set('Authorization', `Bearer ${getToken()}`);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });
});
