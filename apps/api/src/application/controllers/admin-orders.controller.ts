import type { Request, Response } from 'express';
import type { OrderService } from '../../domain/order-service';

const STATUS_LABELS: Record<string, string> = {
  pending: '待確認',
  preparing: '包裝中',
  ready: '包裝完成',
  delivering: '配送中',
  delivered: '已送達',
  problem: '待解決',
  cancelled: '已取消'
};

export class AdminOrdersController {
  constructor(private readonly orderService: OrderService) {}

  list = async (_req: Request, res: Response) => {
    const orders = await this.orderService.list();
    const stats = orders.reduce<Record<string, number>>((acc, order) => {
      acc[order.status] = (acc[order.status] ?? 0) + 1;
      return acc;
    }, {});

    res.json({
      data: orders,
      stats,
      meta: {
        total: orders.length,
        statusLabels: STATUS_LABELS
      }
    });
  };
}
