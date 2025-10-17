import type { Request, Response } from 'express';
import { z } from 'zod';
import type { DriverOrdersService } from '../../domain/driver-orders-service';

const historyQuerySchema = z.object({
  limit: z
    .preprocess(value => (typeof value === 'string' ? Number(value) : value), z.number().int().positive().max(100))
    .optional()
});

const reorderSchema = z.object({
  orderIds: z.array(z.string().uuid()).min(1),
  sequences: z
    .array(
      z.object({
        orderId: z.string().uuid(),
        sequence: z.number().int().min(1)
      })
    )
    .optional()
});

export class DriverOrdersController {
  constructor(private readonly driverOrdersService: DriverOrdersService) {}

  private requireDriver(req: Request, res: Response) {
    const user = (req as any).user as { sub: string; role: string } | undefined;
    if (!user || user.role !== 'DRIVER') {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return undefined;
    }
    return user;
  }

  listActiveOrders = async (req: Request, res: Response) => {
    const user = this.requireDriver(req, res);
    if (!user) return;

    const orders = await this.driverOrdersService.listActiveOrders(user.sub);
    res.json({ data: orders });
  };

  listCompletedOrders = async (req: Request, res: Response) => {
    const user = this.requireDriver(req, res);
    if (!user) return;

    const parsed = historyQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'INVALID_QUERY', issues: parsed.error.flatten() });
    }

    const orders = await this.driverOrdersService.listCompletedOrders(user.sub, parsed.data.limit ?? 20);
    res.json({ data: orders });
  };

  listProblemOrders = async (req: Request, res: Response) => {
    const user = this.requireDriver(req, res);
    if (!user) return;

    const parsed = historyQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'INVALID_QUERY', issues: parsed.error.flatten() });
    }

    const orders = await this.driverOrdersService.listProblemOrders(user.sub, parsed.data.limit ?? 20);
    res.json({ data: orders });
  };

  getOrder = async (req: Request, res: Response) => {
    const user = this.requireDriver(req, res);
    if (!user) return;

    try {
      const order = await this.driverOrdersService.getOrderForDriver(user.sub, req.params.id);
      res.json({ data: order });
    } catch (error: any) {
      if (error instanceof Error) {
        if (error.message === 'ORDER_NOT_FOUND') {
          return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
        }
        if (error.message === 'ORDER_NOT_ASSIGNED_TO_DRIVER') {
          return res.status(403).json({ error: 'ORDER_NOT_ASSIGNED_TO_DRIVER' });
        }
      }

      res.status(500).json({ error: 'UNEXPECTED_ERROR' });
    }
  };

  claimOrder = async (req: Request, res: Response) => {
    const user = this.requireDriver(req, res);
    if (!user) return;

    try {
      const order = await this.driverOrdersService.claimOrder(req.params.id, user);
      res.json({ data: order });
    } catch (error: any) {
      if (error instanceof Error) {
        const message = error.message;
        if (message === 'ORDER_ALREADY_CLAIMED' || message === 'ORDER_NOT_ASSIGNED_TO_DRIVER') {
          return res.status(409).json({ error: message });
        }
        if (message === 'ORDER_NOT_FOUND') {
          return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
        }
        if (message.startsWith('Invalid transition')) {
          return res.status(400).json({ error: 'INVALID_STATUS_TRANSITION' });
        }
      }

      res.status(500).json({ error: 'UNEXPECTED_ERROR' });
    }
  };

  markDelivered = async (req: Request, res: Response) => {
    const user = this.requireDriver(req, res);
    if (!user) return;

    try {
      const order = await this.driverOrdersService.markDelivered(req.params.id, user);
      res.json({ data: order });
    } catch (error: any) {
      if (error instanceof Error) {
        const message = error.message;
        if (message === 'ORDER_NOT_FOUND') {
          return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
        }
        if (message === 'ORDER_NOT_ASSIGNED_TO_DRIVER') {
          return res.status(403).json({ error: 'ORDER_NOT_ASSIGNED_TO_DRIVER' });
        }
        if (message.startsWith('Invalid transition')) {
          return res.status(400).json({ error: 'INVALID_STATUS_TRANSITION' });
        }
      }

      res.status(500).json({ error: 'UNEXPECTED_ERROR' });
    }
  };

  markProblem = async (req: Request, res: Response) => {
    const user = this.requireDriver(req, res);
    if (!user) return;

    try {
      const order = await this.driverOrdersService.markProblem(req.params.id, req.body?.reason, user);
      res.json({ data: order });
    } catch (error: any) {
      if (error instanceof Error) {
        const message = error.message;
        if (message === 'ORDER_NOT_FOUND') {
          return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
        }
        if (message === 'ORDER_NOT_ASSIGNED_TO_DRIVER') {
          return res.status(403).json({ error: 'ORDER_NOT_ASSIGNED_TO_DRIVER' });
        }
        if (message === 'REASON_TOO_SHORT' || message === 'REASON_TOO_LONG') {
          return res.status(400).json({ error: message });
        }
        if (message.startsWith('Invalid transition')) {
          return res.status(400).json({ error: 'INVALID_STATUS_TRANSITION' });
        }
      }

      res.status(500).json({ error: 'UNEXPECTED_ERROR' });
    }
  };

  uploadProof = async (req: Request, res: Response) => {
    const user = this.requireDriver(req, res);
    if (!user) return;

    try {
      const proof = await this.driverOrdersService.saveDeliveryProof(user.sub, req.params.id, (req as any).file);
      res.status(201).json({ data: proof });
    } catch (error: any) {
      if (error instanceof Error) {
        const message = error.message;
        if (message === 'PROOF_FILE_REQUIRED') {
          return res.status(400).json({ error: 'PROOF_FILE_REQUIRED' });
        }
        if (message === 'ORDER_NOT_FOUND') {
          return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
        }
        if (message === 'ORDER_NOT_ASSIGNED_TO_DRIVER') {
          return res.status(403).json({ error: 'ORDER_NOT_ASSIGNED_TO_DRIVER' });
        }
      }

      res.status(500).json({ error: 'UNEXPECTED_ERROR' });
    }
  };

  reorder = async (req: Request, res: Response) => {
    const user = this.requireDriver(req, res);
    if (!user) return;

    const parsed = reorderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'INVALID_PAYLOAD', issues: parsed.error.flatten() });
    }

    const sequences =
      parsed.data.sequences ?? parsed.data.orderIds.map((orderId, index) => ({ orderId, sequence: index + 1 }));

    try {
      const orders = await this.driverOrdersService.reorderActiveOrders(user.sub, sequences);
      res.json({ data: orders });
    } catch (error: any) {
      if (error instanceof Error) {
        if (error.message === 'ORDER_NOT_FOUND') {
          return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
        }
        if (error.message === 'ORDER_NOT_ASSIGNED_TO_DRIVER') {
          return res.status(403).json({ error: 'ORDER_NOT_ASSIGNED_TO_DRIVER' });
        }
      }
      res.status(500).json({ error: 'UNEXPECTED_ERROR' });
    }
  };
}
