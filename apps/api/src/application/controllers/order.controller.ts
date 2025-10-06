import type { Request, Response } from 'express';
import { z, ZodError } from 'zod';
import type { OrderService } from '../../domain/order-service';

const createOrderSchema = z.object({
  contactName: z.string().min(1),
  contactPhone: z.string().min(8),
  address: z.string().min(1),
  paymentMethod: z.enum(['cash', 'transfer', 'line_pay', 'credit']),
  subtotal: z.number().min(0),
  deliveryFee: z.number().min(0),
  totalAmount: z.number().min(0),
  items: z.array(
    z.object({
      productId: z.string(),
      name: z.string(),
      quantity: z.number().positive(),
      unit: z.string(),
      unitPrice: z.number().min(0),
      lineTotal: z.number().min(0)
    })
  ),
  notes: z.string().optional(),
  driverId: z.string().uuid().optional()
});

const updateStatusSchema = z.object({
  status: z.enum(['pending', 'preparing', 'ready', 'delivering', 'delivered', 'problem', 'cancelled']),
  reason: z.string().optional()
});

const searchQuerySchema = z.object({
  phone: z.string().min(8)
});

export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  list = async (_req: Request, res: Response) => {
    const orders = await this.orderService.list();
    res.json({ data: orders });
  };

  create = async (req: Request, res: Response) => {
    try {
      const parsed = createOrderSchema.parse(req.body);
      const order = await this.orderService.create(parsed);
      res.status(201).json({ data: order });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          issues: error.flatten()
        });
      }
      throw error;
    }
  };

  status = async (req: Request, res: Response) => {
    const { id } = req.params;
    const order = await this.orderService.findById(id);
    if (!order) {
      return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
    }
    res.json({ data: order });
  };

  searchByPhone = async (req: Request, res: Response) => {
    const parsed = searchQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'INVALID_PHONE' });
    }
    const orders = await this.orderService.searchByPhone(parsed.data.phone);
    res.json({ data: orders });
  };

  history = async (req: Request, res: Response) => {
    const { id } = req.params;
    const timeline = await this.orderService.getHistory(id);
    res.json({ data: timeline });
  };

  updateStatus = async (req: Request, res: Response) => {
    const { id } = req.params;
    const parsed = updateStatusSchema.parse(req.body);
    const actor = (req as any).user as { sub: string; role: string } | undefined;

    try {
      const order = await this.orderService.updateStatus(id, parsed.status, parsed.reason, actor);
      res.json({ data: order });
    } catch (error: any) {
      if (error instanceof Error) {
        const message = error.message;
        if (message === 'ORDER_ALREADY_CLAIMED' || message === 'ORDER_NOT_ASSIGNED_TO_DRIVER') {
          return res.status(409).json({ error: message });
        }
        if (message.startsWith('Invalid transition')) {
          return res.status(400).json({ error: 'INVALID_STATUS_TRANSITION' });
        }
        if (message === 'Order not found') {
          return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
        }
      }
      res.status(500).json({ error: 'UNEXPECTED_ERROR' });
    }
  };
}
