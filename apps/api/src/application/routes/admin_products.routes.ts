import { Router } from 'express';
import type { AdminProductsController } from '../controllers/admin-products.controller';
import { authenticate } from '../../middleware/auth';
import { csvUpload, productImageUpload } from '../../middleware/upload';

export const createAdminProductsRouter = (controller: AdminProductsController): Router => {
  const router = Router();

  router.use(authenticate(['ADMIN']));
  router.get('/export', controller.exportCsv);
  router.post('/import', csvUpload, controller.importCsv);
  router.post('/bulk', controller.bulkUpsert);
  router.post('/reorder', controller.reorder);
  router.get('/', controller.list);
  router.patch('/:id', controller.update);
  router.patch('/:id/toggle', controller.toggle);
  router.post('/:id/image', productImageUpload, controller.uploadImage);

  return router;
};
