import express from 'express';
import multer from 'multer';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import { OrderController } from '../src/application/controllers/order.controller';
import { createOrderRouter } from '../src/application/routes/order.routes';
import { initAuthMiddleware } from '../src/middleware/auth';

const exampleOrder = {
  id: 'cbe8c0c4-4a1c-4f2d-8ed0-0b6e0bfb5f10',
  contactName: '王小明',
  contactPhone: '0912345678',
  address: '台北市信義區松壽路1號',
  status: 'pending',
  items: [],
  subtotal: 0,
  deliveryFee: 0,
  totalAmount: 0,
  paymentMethod: 'cash'
} as const;

const createTestContext = () => {
  const orderService = {
    list: vi.fn().mockResolvedValue([exampleOrder]),
    create: vi.fn().mockResolvedValue(exampleOrder),
    createWithInventory: vi.fn().mockResolvedValue(exampleOrder),
    findById: vi.fn().mockResolvedValue(exampleOrder),
    searchByPhone: vi.fn().mockResolvedValue([exampleOrder]),
    getHistory: vi.fn().mockResolvedValue([
      { status: 'pending', changedAt: new Date('2025-09-01T00:00:00Z') }
    ]),
    updateStatus: vi.fn().mockResolvedValue({ ...exampleOrder, status: 'ready' })
  } as const;

  const authService = {
    verify: vi.fn().mockReturnValue({ sub: 'admin-id', role: 'ADMIN' })
  } as const;

  const app = express();
  app.use(express.json());

  initAuthMiddleware(authService as any);

  const controller = new OrderController(orderService as any);
  app.use('/orders', createOrderRouter(controller));

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'VALIDATION_ERROR' });
    }
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: 'UPLOAD_ERROR' });
    }
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  });

  return { app, orderService, authService };
};

describe('OrderController routes', () => {
  let app: express.Express;
  let orderService: ReturnType<typeof createTestContext>['orderService'];
  let authService: ReturnType<typeof createTestContext>['authService'];

  beforeEach(() => {
    const context = createTestContext();
    app = context.app;
    orderService = context.orderService;
    authService = context.authService;
  });

  it('returns order list', async () => {
    const response = await request(app).get('/orders');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(orderService.list).toHaveBeenCalledTimes(1);
  });

  it('creates order with valid payload', async () => {
    const response = await request(app)
      .post('/orders')
      .send({
        contactName: exampleOrder.contactName,
        contactPhone: exampleOrder.contactPhone,
        address: exampleOrder.address,
        paymentMethod: exampleOrder.paymentMethod,
        subtotal: 0,
        deliveryFee: 0,
        totalAmount: 0,
        items: []
      });

    expect(response.status).toBe(201);
    expect(orderService.createWithInventory).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid order payload', async () => {
    const response = await request(app)
      .post('/orders')
      .send({
        contactPhone: exampleOrder.contactPhone,
        address: exampleOrder.address,
        paymentMethod: exampleOrder.paymentMethod,
        subtotal: 0,
        deliveryFee: 0,
        totalAmount: 0,
        items: []
      });

    expect(response.status).toBe(400);
    expect(orderService.createWithInventory).not.toHaveBeenCalled();
  });

  it('returns order history', async () => {
    const response = await request(app).get(`/orders/${exampleOrder.id}/history`);

    expect(response.status).toBe(200);
    expect(orderService.getHistory).toHaveBeenCalledWith(exampleOrder.id);
  });

  it('requires authorization when updating status', async () => {
    const response = await request(app)
      .patch(`/orders/${exampleOrder.id}/status`)
      .send({ status: 'ready' });

    expect(response.status).toBe(401);
    expect(orderService.updateStatus).not.toHaveBeenCalled();
  });

  it('updates status when token is valid', async () => {
    const response = await request(app)
      .patch(`/orders/${exampleOrder.id}/status`)
      .set('Authorization', 'Bearer token')
      .send({ status: 'ready' });

    expect(response.status).toBe(200);
    expect(authService.verify).toHaveBeenCalledWith('token');
    expect(orderService.updateStatus).toHaveBeenCalledWith(
      exampleOrder.id,
      'ready',
      undefined,
      expect.objectContaining({ sub: 'admin-id', role: 'ADMIN' })
    );
  });
});
