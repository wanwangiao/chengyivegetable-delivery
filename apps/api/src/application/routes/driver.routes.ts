import { Router } from 'express';
import type { DriverController } from '../controllers/driver.controller';
import type { DriverDeliveryController } from '../controllers/driver-delivery.controller';
import { authenticate } from '../../middleware/auth';

export const createDriverRouter = (
  controller: DriverController,
  deliveryController: DriverDeliveryController,
): Router => {
  const router = Router();

  router.get('/', authenticate(['ADMIN']), controller.listDrivers);
  router.get('/me', authenticate(['DRIVER']), controller.profile);
  router.get('/stats', authenticate(['ADMIN']), controller.stats);
  router.get('/available-orders', authenticate(['ADMIN', 'DRIVER']), controller.listAvailableOrders);
  router.get('/recommended-batches', authenticate(['ADMIN', 'DRIVER']), deliveryController.recommendedBatches);
  router.patch('/:id/status', authenticate(['ADMIN', 'DRIVER']), controller.updateStatus);
  router.patch('/:id/location', authenticate(['ADMIN', 'DRIVER']), controller.updateLocation);

  return router;
};
