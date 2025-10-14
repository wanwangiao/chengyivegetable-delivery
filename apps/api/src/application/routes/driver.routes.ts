import { Router } from 'express';
import type { DriverController } from '../controllers/driver.controller';
import type { DriverOrdersController } from '../controllers/driver-orders.controller';
import type { DriverDeliveryController } from '../controllers/driver-delivery.controller';
import { authenticate } from '../../middleware/auth';
import { deliveryProofUpload } from '../../middleware/upload';

export const createDriverRouter = (
  controller: DriverController,
  ordersController: DriverOrdersController,
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
  router.get('/me/orders/active', authenticate(['DRIVER']), ordersController.listActiveOrders);
  router.get('/me/orders/history', authenticate(['DRIVER']), ordersController.listCompletedOrders);
  router.get('/me/orders/problem', authenticate(['DRIVER']), ordersController.listProblemOrders);
  router.get('/me/orders/:id', authenticate(['DRIVER']), ordersController.getOrder);
  router.post('/orders/:id/claim', authenticate(['DRIVER']), ordersController.claimOrder);
  router.post('/orders/:id/deliver', authenticate(['DRIVER']), ordersController.markDelivered);
  router.post('/orders/:id/problem', authenticate(['DRIVER']), ordersController.markProblem);
  router.post('/orders/:id/proof', authenticate(['DRIVER']), deliveryProofUpload, ordersController.uploadProof);

  return router;
};
