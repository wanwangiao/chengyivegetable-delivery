import { Router } from 'express';
import type { BusinessHoursController } from '../controllers/business-hours.controller';
import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/async-handler';

export const createBusinessHoursRouter = (controller: BusinessHoursController): Router => {
  const router = Router();

  // Public routes - 任何人都可以查詢
  router.get('/status', asyncHandler(controller.checkStatus));
  router.get('/validate', asyncHandler(controller.validateOrderTiming));
  router.get('/', asyncHandler(controller.getSettings));
  router.get('/special-dates', asyncHandler(controller.getSpecialDatesByMonth));

  // Admin only routes - 只有管理員可以修改
  router.use(authenticate(['ADMIN']));
  router.patch('/:id', asyncHandler(controller.updateSettings));
  router.post('/special-dates', asyncHandler(controller.addSpecialDate));
  router.delete('/special-dates/:id', asyncHandler(controller.deleteSpecialDate));

  return router;
};
