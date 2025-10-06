import type { Request, Response } from 'express';
import { AuthService } from '../../domain/auth-service';

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  register = async (req: Request, res: Response) => {
    try {
      const tokens = await this.authService.register(req.body);
      res.status(201).json(tokens);
    } catch (error: any) {
      if (error.message === 'EMAIL_EXISTS') {
        return res.status(409).json({ error: 'EMAIL_EXISTS' });
      }
      res.status(400).json({ error: error.message ?? 'BAD_REQUEST' });
    }
  };

  login = async (req: Request, res: Response) => {
    try {
      const tokens = await this.authService.login(req.body);
      res.json(tokens);
    } catch (error: any) {
      res.status(401).json({ error: error.message ?? 'INVALID_CREDENTIALS' });
    }
  };
}
