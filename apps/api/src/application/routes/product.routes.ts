import { Router } from 'express';
import type { ProductController } from '../controllers/product.controller';
import { asyncHandler } from '../../middleware/async-handler';

export const createProductRouter = (controller: ProductController): Router => {
  const router = Router();

  router.get('/', asyncHandler(controller.list));
  router.post('/', asyncHandler(controller.create));
  router.patch('/:id', asyncHandler(controller.update));
  router.patch('/:id/toggle', asyncHandler(controller.toggle));

  return router;
};
