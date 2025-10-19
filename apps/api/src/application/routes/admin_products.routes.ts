import { Router } from 'express';
import type { AdminProductsController } from '../controllers/admin-products.controller';
import { authenticate } from '../../middleware/auth';
import { csvUpload, productImageUpload } from '../../middleware/upload';
import { asyncHandler } from '../../middleware/async-handler';

export const createAdminProductsRouter = (controller: AdminProductsController): Router => {
  const router = Router();

  router.use(authenticate(['ADMIN']));
  router.get('/export', asyncHandler(controller.exportCsv));
  router.post('/import', csvUpload, asyncHandler(controller.importCsv));
  router.post('/bulk', asyncHandler(controller.bulkUpsert));
  router.post('/reorder', asyncHandler(controller.reorder));
  router.post('/sync-next-day-prices', asyncHandler(controller.syncNextDayPrices));
  router.post('/check-price-changes', asyncHandler(controller.checkPriceChanges));
  router.get('/', asyncHandler(controller.list));
  router.patch('/:id', asyncHandler(controller.update));
  router.patch('/:id/toggle', asyncHandler(controller.toggle));
  router.post('/:id/image', productImageUpload, asyncHandler(controller.uploadImage));

  return router;
};
