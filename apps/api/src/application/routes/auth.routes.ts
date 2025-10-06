import { Router } from 'express';
import type { AuthController } from '../controllers/auth.controller';

export const createAuthRouter = (controller: AuthController) => {
  const router = Router();
  router.post('/register', controller.register);
  router.post('/login', controller.login);
  return router;
};
