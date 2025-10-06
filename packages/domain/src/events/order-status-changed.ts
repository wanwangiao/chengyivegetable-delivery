import { z } from 'zod';
import type { OrderStatus } from '../models/order';

export const OrderStatusChangedEventSchema = z.object({
  orderId: z.string().uuid(),
  previousStatus: z.string(),
  newStatus: z.string(),
  reason: z.string().optional(),
  changedAt: z.date()
});

export type OrderStatusChangedEvent = z.infer<typeof OrderStatusChangedEventSchema> & {
  previousStatus: OrderStatus;
  newStatus: OrderStatus;
};

export const createOrderStatusChangedEvent = (payload: {
  orderId: string;
  previousStatus: OrderStatus;
  newStatus: OrderStatus;
  reason?: string;
  changedAt?: Date;
}): OrderStatusChangedEvent => {
  const parsed = OrderStatusChangedEventSchema.parse({
    ...payload,
    changedAt: payload.changedAt ?? new Date()
  });

  return {
    ...parsed,
    previousStatus: payload.previousStatus,
    newStatus: payload.newStatus
  };
};
