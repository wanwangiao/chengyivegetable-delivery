import type { Request, Response, NextFunction } from 'express';
import type { AuthService } from '../domain/auth-service';

let authService: AuthService;

export const initAuthMiddleware = (service: AuthService) => {
  authService = service;
};

export const authenticate = (roles?: string[]) => (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }

  const token = header.substring(7);
  try {
    const payload = authService.verify(token);
    if (roles && !roles.includes(payload.role)) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }
    (req as any).user = payload;
    next();
  } catch (error) {
    res.status(401).json({ error: 'UNAUTHORIZED' });
  }
};
