import { Router } from 'express';
import type { OrderController } from '../controllers/order.controller';
import { authenticate } from '../../middleware/auth';
import { orderLimiter } from '../../middleware/rate-limit';

export const createOrderRouter = (controller: OrderController): Router => {
  const router = Router();

  router.get('/', controller.list);
  // 開發環境跳過 rate limiting 以利測試
  const middlewares = process.env.NODE_ENV === 'development' ? [] : [orderLimiter];
  router.post('/', ...middlewares, controller.create);
  router.get('/search', controller.searchByPhone);
  router.get('/:id/history', controller.history);
  router.get('/:id', controller.status);
  router.patch('/:id/status', authenticate(['ADMIN', 'DRIVER']), controller.updateStatus);

  return router;
};
