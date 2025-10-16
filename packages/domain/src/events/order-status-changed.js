import { z } from 'zod';
export const OrderStatusChangedEventSchema = z.object({
    orderId: z.string().uuid(),
    previousStatus: z.string(),
    newStatus: z.string(),
    reason: z.string().optional(),
    changedAt: z.date()
});
export const createOrderStatusChangedEvent = (payload) => {
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
//# sourceMappingURL=order-status-changed.js.map