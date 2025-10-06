import type { Request, Response } from 'express';
import { UserManagementService } from '../../domain/user-management-service';

export class UserManagementController {
  constructor(private readonly userService: UserManagementService) {}

  list = async (_req: Request, res: Response) => {
    const users = await this.userService.list();
    res.json({ data: users });
  };

  create = async (req: Request, res: Response) => {
    try {
      const user = await this.userService.create(req.body);
      res.status(201).json({ data: user });
    } catch (error: any) {
      if (error.message === 'EMAIL_EXISTS') {
        return res.status(409).json({ error: 'EMAIL_EXISTS' });
      }
      res.status(400).json({ error: error.message ?? 'BAD_REQUEST' });
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      const user = await this.userService.update(req.params.id, req.body);
      res.json({ data: user });
    } catch (error: any) {
      res.status(400).json({ error: error.message ?? 'BAD_REQUEST' });
    }
  };
}
