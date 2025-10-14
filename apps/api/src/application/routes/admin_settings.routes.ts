import { Router } from 'express';
import type { AdminSettingsController } from '../controllers/admin-settings.controller';
import { authenticate } from '../../middleware/auth';

export const createAdminSettingsRouter = (controller: AdminSettingsController): Router => {
  const router = Router();

  router.get('/', authenticate(['ADMIN']), controller.getConfig);
  router.patch('/', authenticate(['ADMIN']), controller.updateConfig);
  router.post('/process-timeout-alerts', authenticate(['ADMIN']), controller.processTimeoutAlerts);

  return router;
};
