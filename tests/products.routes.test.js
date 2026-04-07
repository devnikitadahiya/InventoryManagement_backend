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

  test('POST /api/products should reject negative unit_price', async () => {
    const response = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${getToken()}`)
      .send({
        sku: 'SKU041',
        product_name: 'Invalid Product',
        unit_price: -1,
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('unit_price');
  });

  test('POST /api/products should reject very large numeric values', async () => {
    const response = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${getToken()}`)
      .send({
        sku: 'SKU-BIG-001',
        product_name: 'Enterprise Rack',
        unit_price: 1000000001,
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('cannot exceed');
  });

  test('POST /api/products should reject unsafe characters in product_name', async () => {
    const response = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${getToken()}`)
      .send({
        sku: 'SKU-SAFE-001',
        product_name: '<script>alert(1)</script>',
        unit_price: 3000,
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('unsupported characters');
  });

  test('PUT /api/products/:id should update an existing product', async () => {
    db.query
      .mockResolvedValueOnce([[{ product_id: 1 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[
        {
          product_id: 1,
          sku: 'SKU001',
          product_name: 'Laptop Pro',
          unit_price: 70000,
          current_stock: 10,
        },
      ]]);

    const response = await request(app)
      .put('/api/products/1')
      .set('Authorization', `Bearer ${getToken()}`)
      .send({ product_name: 'Laptop Pro', unit_price: 70000 });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.product_name).toBe('Laptop Pro');
  });

  test('PUT /api/products/:id should reject negative current_stock', async () => {
    const response = await request(app)
      .put('/api/products/1')
      .set('Authorization', `Bearer ${getToken()}`)
      .send({ current_stock: -5 });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('current_stock');
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

  test('DELETE /api/products/:id should reject staff role with 403', async () => {
    const response = await request(app)
      .delete('/api/products/1')
      .set('Authorization', `Bearer ${getToken('staff')}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });
});
