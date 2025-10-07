import { Router } from 'express';
import type { AdminDeliveryController } from '../controllers/admin-delivery.controller';
import { authenticate } from '../../middleware/auth';

export const createAdminDeliveryRouter = (controller: AdminDeliveryController): Router => {
  const router = Router();

  router.use(authenticate(['ADMIN']));

  router.get('/settings', controller.getSettings);
  router.put('/settings', controller.updateSettings);
  router.post('/plan-route', controller.planRoute);
  router.get('/map-snapshot', controller.mapSnapshot);
  router.get('/recommended-batches', controller.recommendedBatches);

  return router;
};
