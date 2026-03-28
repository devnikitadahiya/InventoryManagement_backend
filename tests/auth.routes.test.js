jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const app = require('../server');

// Helper: create a signed token for a given role
const makeToken = (role = 'admin') =>
  jwt.sign({ id: 1, email: `${role}@test.com`, role }, process.env.JWT_SECRET, { expiresIn: '1h' });

describe('Auth routes', () => {
  test('POST /api/auth/register should reject request with no token (401)', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ full_name: 'Test', email: 'test@example.com', password: 'pass1234' });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  test('POST /api/auth/register admin can create a manager account', async () => {
    db.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 101 }]);

    const response = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ full_name: 'New Manager', email: 'mgr@example.com', password: 'pass1234', role: 'manager' });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user_id).toBe(101);
    expect(response.body.data.role).toBe('manager');
  });

  test('POST /api/auth/register manager can create a staff account', async () => {
    db.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 102 }]);

    const response = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${makeToken('manager')}`)
      .send({ full_name: 'New Staff', email: 'staff@example.com', password: 'pass1234', role: 'staff' });

    expect(response.status).toBe(201);
    expect(response.body.data.role).toBe('staff');
  });

  test('POST /api/auth/register manager cannot create a manager account (403)', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${makeToken('manager')}`)
      .send({ full_name: 'Sneaky', email: 'sneaky@example.com', password: 'pass1234', role: 'manager' });

    expect(response.status).toBe(403);
    expect(response.body.message).toContain('Managers can only create staff accounts');
  });

  test('POST /api/auth/register should reject duplicate email', async () => {
    db.query.mockResolvedValueOnce([[{ user_id: 1 }]]);

    const response = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ full_name: 'Existing User', email: 'existing@example.com', password: 'pass1234' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('already registered');
  });

  test('POST /api/auth/login should return token for valid credentials', async () => {
    const passwordHash = await bcrypt.hash('pass1234', 10);
    db.query.mockResolvedValueOnce([[
      { user_id: 7, full_name: 'Admin User', email: 'admin@inventory.com', role: 'admin', password_hash: passwordHash },
    ]]);

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@inventory.com', password: 'pass1234' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.token).toBeTruthy();
    expect(response.body.data.user.role).toBe('admin');
  });

  test('POST /api/auth/login should reject invalid credentials', async () => {
    db.query.mockResolvedValueOnce([[]]);

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'wrong@example.com', password: 'wrongpass' });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  test('GET /api/auth/me should reject missing token', async () => {
    const response = await request(app).get('/api/auth/me');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  test('GET /api/auth/me should return user details with valid token', async () => {
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${makeToken('manager')}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.user.role).toBe('manager');
  });

  test('GET /api/auth/users returns list for admin', async () => {
    db.query.mockResolvedValueOnce([[
      { user_id: 1, full_name: 'Admin', email: 'admin@test.com', role: 'admin', created_at: '2026-01-01' },
    ]]);

    const response = await request(app)
      .get('/api/auth/users')
      .set('Authorization', `Bearer ${makeToken('admin')}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  test('GET /api/auth/users returns list for manager', async () => {
    db.query.mockResolvedValueOnce([[
      { user_id: 2, full_name: 'Staff', email: 'staff@test.com', role: 'staff', created_at: '2026-01-01' },
    ]]);

    const response = await request(app)
      .get('/api/auth/users')
      .set('Authorization', `Bearer ${makeToken('manager')}`);

    expect(response.status).toBe(200);
    expect(response.body.data[0].role).toBe('staff');
  });

  test('GET /api/auth/users rejects staff role with 403', async () => {
    const response = await request(app)
      .get('/api/auth/users')
      .set('Authorization', `Bearer ${makeToken('staff')}`);

    expect(response.status).toBe(403);
  });
});

