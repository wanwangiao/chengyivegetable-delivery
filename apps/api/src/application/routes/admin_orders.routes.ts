import { Router } from 'express';
import type { AdminOrdersController } from '../controllers/admin-orders.controller';
import { authenticate } from '../../middleware/auth';

export const createAdminOrdersRouter = (controller: AdminOrdersController): Router => {
  const router = Router();
  router.use(authenticate(['ADMIN']));
  router.get('/', controller.list);
  return router;
};
