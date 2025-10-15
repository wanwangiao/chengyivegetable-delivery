import { Router } from 'express';
import type { AuthController } from '../controllers/auth.controller';
import { loginLimiter } from '../../middleware/rate-limit';

export const createAuthRouter = (controller: AuthController): Router => {
  const router = Router();
  router.post('/register', controller.register);
  router.post('/login', loginLimiter, controller.login);
  return router;
};
