jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const app = require('../server');

const getToken = () =>
  jwt.sign({ id: 1, email: 'admin@inventory.com', role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });

describe('Forecast routes', () => {
  beforeEach(() => {
    db.query.mockReset();
  });

  test('GET /api/forecast/:product_id should reject invalid days', async () => {
    const response = await request(app)
      .get('/api/forecast/1?days=9')
      .set('Authorization', `Bearer ${getToken()}`);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  test('GET /api/forecast/:product_id should return generated forecast', async () => {
    db.query
      .mockResolvedValueOnce([[{ product_id: 1, sku: 'ELEC-001', product_name: 'Laptop', current_stock: 20, reorder_level: 10 }]])
      .mockResolvedValueOnce([[{ sale_date: '2026-01-01', quantity_sold: 2 }, { sale_date: '2026-01-02', quantity_sold: 3 }]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{}]);

    const response = await request(app)
      .get('/api/forecast/1?days=7')
      .set('Authorization', `Bearer ${getToken()}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.horizon_days).toBe(7);
    expect(Array.isArray(response.body.data.predictions)).toBe(true);
    expect(response.body.data.predictions).toHaveLength(7);
  });

  test('GET /api/forecast/summary should return product-wise forecast summary', async () => {
    db.query
      .mockResolvedValueOnce([[{ product_id: 1, sku: 'ELEC-001', product_name: 'Laptop', current_stock: 20 }]])
      .mockResolvedValueOnce([[{ sale_date: '2026-01-01', quantity_sold: 4 }, { sale_date: '2026-01-02', quantity_sold: 5 }]]);

    const response = await request(app)
      .get('/api/forecast/summary?days=15')
      .set('Authorization', `Bearer ${getToken()}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.filters.days).toBe(15);
    expect(response.body.data[0].product_id).toBe(1);
  });
});
