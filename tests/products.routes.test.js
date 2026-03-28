jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const app = require('../server');

const getToken = (role = 'admin') =>
  jwt.sign({ id: 1, email: 'tester@example.com', role }, process.env.JWT_SECRET, { expiresIn: '1h' });

describe('Products routes', () => {
  test('GET /api/products should require token', async () => {
    const response = await request(app).get('/api/products');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  test('GET /api/products should return paginated products', async () => {
    db.query
      .mockResolvedValueOnce([[{ total: 1 }]])
      .mockResolvedValueOnce([[
        {
          product_id: 1,
          sku: 'SKU001',
          product_name: 'Laptop',
          unit_price: 50000,
          current_stock: 10,
        },
      ]]);

    const response = await request(app)
      .get('/api/products?page=1&limit=10&search=lap')
      .set('Authorization', `Bearer ${getToken()}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.pagination.total).toBe(1);
  });

  test('POST /api/products should reject duplicate sku', async () => {
    db.query.mockResolvedValueOnce([[{ product_id: 1 }]]);

    const response = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${getToken()}`)
      .send({
        sku: 'SKU001',
        product_name: 'Laptop',
        unit_price: 50000,
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  test('POST /api/products should create a new product', async () => {
    db.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 40 }]);

    const response = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${getToken()}`)
      .send({
        sku: 'SKU040',
        product_name: 'Keyboard',
        unit_price: 2000,
        current_stock: 25,
        reorder_level: 5,
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.product_id).toBe(40);
  });

  test('GET /api/products/:id should reject invalid id', async () => {
    const response = await request(app)
      .get('/api/products/abc')
      .set('Authorization', `Bearer ${getToken()}`);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  test('DELETE /api/products/:id should return 404 when no active row updated', async () => {
    db.query.mockResolvedValueOnce([{ affectedRows: 0 }]);

    const response = await request(app)
      .delete('/api/products/333')
      .set('Authorization', `Bearer ${getToken()}`);

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });
});
