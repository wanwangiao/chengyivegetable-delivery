import { Router } from 'express';
import type { OrderController } from '../controllers/order.controller';
import { authenticate } from '../../middleware/auth';
import { orderLimiter } from '../../middleware/rate-limit';

export const createOrderRouter = (controller: OrderController): Router => {
  const router = Router();

  router.get('/', controller.list);
  router.post('/', orderLimiter, controller.create);
  router.get('/search', controller.searchByPhone);
  router.get('/:id/history', controller.history);
  router.get('/:id', controller.status);
  router.patch('/:id/status', authenticate(['ADMIN', 'DRIVER']), controller.updateStatus);

  return router;
};
