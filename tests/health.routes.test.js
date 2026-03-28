jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

const request = require('supertest');
const db = require('../config/database');
const app = require('../server');

describe('Health and root routes', () => {
  test('GET / should return API metadata', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toContain('Smart Inventory');
  });

  test('GET /api/health should return healthy state', async () => {
    db.query.mockResolvedValueOnce([[{ ok: 1 }]]);

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.status).toBe('healthy');
  });

  test('GET /api/health should return unhealthy state when db fails', async () => {
    db.query.mockRejectedValueOnce(new Error('DB unavailable'));

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.status).toBe('unhealthy');
  });
});
