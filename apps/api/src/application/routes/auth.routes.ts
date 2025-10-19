import { Router } from 'express';
import type { AuthController } from '../controllers/auth.controller';
import { loginLimiter } from '../../middleware/rate-limit';

export const createAuthRouter = (controller: AuthController): Router => {
  const router = Router();
  router.post('/register', controller.register);
  // 開發環境跳過 rate limiting 以利測試
  const middlewares = process.env.NODE_ENV === 'development' ? [] : [loginLimiter];
  router.post('/login', ...middlewares, controller.login);
  return router;
};
