import { Router } from 'express';
import type { UserManagementController } from '../controllers/user-management.controller';
import { authenticate } from '../../middleware/auth';

export const createAdminUsersRouter = (controller: UserManagementController): Router => {
  const router = Router();

  router.use(authenticate(['ADMIN']));
  router.get('/', controller.list);
  router.post('/', controller.create);
  router.patch('/:id', controller.update);
  router.delete('/:id', controller.delete);

  return router;
};
