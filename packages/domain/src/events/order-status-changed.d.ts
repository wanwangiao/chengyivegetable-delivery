import { z } from 'zod';
import type { OrderStatus } from '../models/order';
export declare const OrderStatusChangedEventSchema: z.ZodObject<{
    orderId: z.ZodString;
    previousStatus: z.ZodString;
    newStatus: z.ZodString;
    reason: z.ZodOptional<z.ZodString>;
    changedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    orderId: string;
    previousStatus: string;
    newStatus: string;
    changedAt: Date;
    reason?: string | undefined;
}, {
    orderId: string;
    previousStatus: string;
    newStatus: string;
    changedAt: Date;
    reason?: string | undefined;
}>;
export type OrderStatusChangedEvent = z.infer<typeof OrderStatusChangedEventSchema> & {
    previousStatus: OrderStatus;
    newStatus: OrderStatus;
};
export declare const createOrderStatusChangedEvent: (payload: {
    orderId: string;
    previousStatus: OrderStatus;
    newStatus: OrderStatus;
    reason?: string;
    changedAt?: Date;
}) => OrderStatusChangedEvent;
//# sourceMappingURL=order-status-changed.d.ts.map