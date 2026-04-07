jest.mock('../config/database', () => ({
  query: jest.fn(),
  getConnection: jest.fn(),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const app = require('../server');

const getToken = () =>
  jwt.sign({ id: 10, email: 'admin@inventory.com', role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });

describe('Transactions routes', () => {
  test('POST /api/transactions/stock-in should insert transaction and update stock', async () => {
    const connection = {
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      query: jest
        .fn()
        .mockResolvedValueOnce([[
          { product_id: 1, sku: 'SKU001', product_name: 'Laptop', current_stock: 10 },
        ]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([{ insertId: 501 }])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([{ affectedRows: 1 }]),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    };

    db.getConnection.mockResolvedValueOnce(connection);

    const response = await request(app)
      .post('/api/transactions/stock-in')
      .set('Authorization', `Bearer ${getToken()}`)
      .send({
        product_id: 1,
        quantity: 5,
        unit_price: 1200,
        reference_number: 'PO-001',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.transaction_id).toBe(501);
    expect(response.body.data.opening_stock).toBe(10);
    expect(response.body.data.closing_stock).toBe(15);
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.release).toHaveBeenCalledTimes(1);
  });

  test('POST /api/transactions/stock-out should reject insufficient stock', async () => {
    const connection = {
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValueOnce([[
        { product_id: 2, sku: 'SKU002', product_name: 'Mouse', current_stock: 2 },
      ]]),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    };

    db.getConnection.mockResolvedValueOnce(connection);

    const response = await request(app)
      .post('/api/transactions/stock-out')
      .set('Authorization', `Bearer ${getToken()}`)
      .send({
        product_id: 2,
        quantity: 5,
        unit_price: 100,
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('Insufficient stock');
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.release).toHaveBeenCalledTimes(1);
  });

  test('GET /api/transactions should validate transaction type query', async () => {
    const response = await request(app)
      .get('/api/transactions?type=wrong')
      .set('Authorization', `Bearer ${getToken()}`);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  test('POST /api/transactions/stock-in should reject zero quantity', async () => {
    const response = await request(app)
      .post('/api/transactions/stock-in')
      .set('Authorization', `Bearer ${getToken()}`)
      .send({
        product_id: 1,
        quantity: 0,
        unit_price: 500,
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('positive integer');
  });

  test('POST /api/transactions/stock-out should reject negative quantity', async () => {
    const response = await request(app)
      .post('/api/transactions/stock-out')
      .set('Authorization', `Bearer ${getToken()}`)
      .send({
        product_id: 1,
        quantity: -3,
        unit_price: 500,
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('positive integer');
  });

  test('POST /api/transactions/stock-in should rollback when database write fails', async () => {
    const connection = {
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      query: jest
        .fn()
        .mockResolvedValueOnce([[
          { product_id: 1, sku: 'SKU001', product_name: 'Laptop', current_stock: 10 },
        ]])
        .mockResolvedValueOnce([[]])
        .mockRejectedValueOnce(new Error('db insert failure')),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    };

    db.getConnection.mockResolvedValueOnce(connection);

    const response = await request(app)
      .post('/api/transactions/stock-in')
      .set('Authorization', `Bearer ${getToken()}`)
      .send({
        product_id: 1,
        quantity: 5,
        unit_price: 1000,
      });

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.release).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
  });

  test('POST /api/transactions/stock-in should reject duplicate reference_number', async () => {
    const connection = {
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      query: jest
        .fn()
        .mockResolvedValueOnce([[
          { product_id: 1, sku: 'SKU001', product_name: 'Laptop', current_stock: 10 },
        ]])
        .mockResolvedValueOnce([[{ transaction_id: 99 }]]),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    };

    db.getConnection.mockResolvedValueOnce(connection);

    const response = await request(app)
      .post('/api/transactions/stock-in')
      .set('Authorization', `Bearer ${getToken()}`)
      .send({
        product_id: 1,
        quantity: 2,
        unit_price: 1000,
        reference_number: 'PO-DUP-001',
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('Duplicate reference_number');
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.release).toHaveBeenCalledTimes(1);
  });

  test('POST /api/transactions/stock-out should reject duplicate reference_number', async () => {
    const connection = {
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      query: jest
        .fn()
        .mockResolvedValueOnce([[
          { product_id: 1, sku: 'SKU001', product_name: 'Laptop', current_stock: 10 },
        ]])
        .mockResolvedValueOnce([[{ transaction_id: 100 }]]),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    };

    db.getConnection.mockResolvedValueOnce(connection);

    const response = await request(app)
      .post('/api/transactions/stock-out')
      .set('Authorization', `Bearer ${getToken()}`)
      .send({
        product_id: 1,
        quantity: 2,
        unit_price: 1000,
        reference_number: 'SO-DUP-001',
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('Duplicate reference_number');
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.release).toHaveBeenCalledTimes(1);
  });

  test('POST /api/transactions/stock-out should use row lock and persist stock history with consistent closing stock', async () => {
    const connection = {
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      query: jest
        .fn()
        .mockResolvedValueOnce([[
          { product_id: 3, sku: 'SKU003', product_name: 'Keyboard', current_stock: 20 },
        ]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([{ insertId: 601 }])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([{ affectedRows: 1 }]),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    };

    db.getConnection.mockResolvedValueOnce(connection);

    const response = await request(app)
      .post('/api/transactions/stock-out')
      .set('Authorization', `Bearer ${getToken()}`)
      .send({
        product_id: 3,
        quantity: 4,
        unit_price: 900,
        reference_number: 'SO-LOCK-001',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.opening_stock).toBe(20);
    expect(response.body.data.closing_stock).toBe(16);

    const firstQuerySql = connection.query.mock.calls[0][0];
    expect(firstQuerySql).toContain('FOR UPDATE');

    const stockHistoryArgs = connection.query.mock.calls[4][1];
    expect(stockHistoryArgs).toEqual([3, expect.any(String), 20, 0, 4, 16]);
  });
});
