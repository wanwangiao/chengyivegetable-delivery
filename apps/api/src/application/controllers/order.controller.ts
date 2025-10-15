import type { Request, Response } from 'express';
import { z, ZodError } from 'zod';
import type { OrderService } from '../../domain/order-service';
import { prisma } from '../../infrastructure/prisma/client';
import { logger } from '@chengyi/lib';

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
  driverId: z.string().uuid().optional(),
  lineUserId: z.string().optional(), // ✨ 新增：LINE User ID
  lineDisplayName: z.string().optional() // ✨ 新增：LINE 顯示名稱
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

      // ✨ 自動註冊或更新 LINE 使用者
      if (parsed.lineUserId && parsed.contactPhone) {
        try {
          await prisma.lineUser.upsert({
            where: { lineUserId: parsed.lineUserId },
            update: {
              phone: parsed.contactPhone,
              displayName: parsed.lineDisplayName || parsed.contactName
            },
            create: {
              lineUserId: parsed.lineUserId,
              displayName: parsed.lineDisplayName || parsed.contactName,
              phone: parsed.contactPhone
            }
          });
          logger.info({ lineUserId: parsed.lineUserId, phone: parsed.contactPhone }, 'LINE user registered/updated');
        } catch (lineUserError) {
          // LINE 使用者註冊失敗不影響訂單建立
          logger.error({ error: lineUserError }, 'Failed to register LINE user');
        }
      }

      const order = await this.orderService.createWithInventory(parsed);
      res.status(201).json({ data: order });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          issues: error.flatten()
        });
      }
      if (error instanceof Error) {
        // 處理價格驗證錯誤
        if (error.message.startsWith('PRICE_MISMATCH:')) {
          return res.status(400).json({
            error: 'PRICE_MISMATCH',
            message: error.message
          });
        }
        // 處理運費驗證錯誤
        if (error.message.startsWith('DELIVERY_FEE_MISMATCH:')) {
          return res.status(400).json({
            error: 'DELIVERY_FEE_MISMATCH',
            message: error.message
          });
        }
        // 處理總金額驗證錯誤
        if (error.message.startsWith('TOTAL_AMOUNT_MISMATCH:')) {
          return res.status(400).json({
            error: 'TOTAL_AMOUNT_MISMATCH',
            message: error.message
          });
        }
        // 處理商品不存在錯誤
        if (error.message.startsWith('PRODUCT_NOT_FOUND:')) {
          return res.status(404).json({
            error: 'PRODUCT_NOT_FOUND',
            message: error.message
          });
        }
        // 處理庫存不足錯誤
        if (error.message.startsWith('INSUFFICIENT_STOCK:')) {
          return res.status(409).json({
            error: 'INSUFFICIENT_STOCK',
            message: error.message
          });
        }
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
