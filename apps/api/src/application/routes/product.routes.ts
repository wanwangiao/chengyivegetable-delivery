import { Router } from 'express';
import type { ProductController } from '../controllers/product.controller';

export const createProductRouter = (controller: ProductController): Router => {
  const router = Router();

  router.get('/', controller.list);
  router.post('/', controller.create);
  router.patch('/:id', controller.update);
  router.patch('/:id/toggle', controller.toggle);

  return router;
};
