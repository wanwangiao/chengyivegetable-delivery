import { z } from 'zod';
export const ORDER_STATUSES = [
    'pending',
    'preparing',
    'ready',
    'delivering',
    'delivered',
    'problem',
    'cancelled'
];
export const DeliveryProofSchema = z.object({
    id: z.string().uuid(),
    orderId: z.string().uuid(),
    driverId: z.string().uuid(),
    imageUrl: z.string().min(1),
    createdAt: z.union([z.string(), z.date()])
});
export const orderStatusFlow = {
    pending: ['preparing', 'cancelled'],
    preparing: ['ready', 'cancelled'],
    ready: ['delivering', 'problem'],
    delivering: ['delivered', 'problem'],
    delivered: [],
    problem: ['ready', 'cancelled'],
    cancelled: []
};
export const OrderItemSchema = z.object({
    productId: z.string(),
    name: z.string(),
    quantity: z.number().positive(),
    unit: z.string(),
    unitPrice: z.number().min(0),
    lineTotal: z.number().min(0)
});
export const OrderSchema = z.object({
    id: z.string().uuid(),
    contactName: z.string().min(1),
    contactPhone: z.string().min(8),
    address: z.string().min(1),
    latitude: z.number().refine(val => Math.abs(val) <= 90, 'Invalid latitude').optional(),
    longitude: z.number().refine(val => Math.abs(val) <= 180, 'Invalid longitude').optional(),
    geocodedAt: z.union([z.string(), z.date()]).optional(),
    status: z.enum(ORDER_STATUSES),
    items: z.array(OrderItemSchema),
    subtotal: z.number().min(0),
    deliveryFee: z.number().min(0),
    totalAmount: z.number().min(0),
    paymentMethod: z.enum(['cash', 'transfer', 'line_pay', 'credit']),
    notes: z.string().optional(),
    driverId: z.string().uuid().optional(),
    deliveryDate: z.union([z.string(), z.date()]).optional(),
    isPreOrder: z.boolean().optional(),
    priceAlertSent: z.boolean().optional(),
    priceConfirmed: z.boolean().optional(),
    priceAlertSentAt: z.union([z.string(), z.date()]).optional(),
    createdAt: z.union([z.string(), z.date()]).optional(),
    updatedAt: z.union([z.string(), z.date()]).optional(),
    deliveryProofs: z.array(DeliveryProofSchema).optional()
});
export const canTransition = (from, to) => {
    return orderStatusFlow[from].includes(to);
};
export class OrderEntity {
    constructor(order) {
        this.state = OrderSchema.parse(order);
    }
    get snapshot() {
        return this.state;
    }
    canTransitionTo(status) {
        return canTransition(this.state.status, status);
    }
}
//# sourceMappingURL=order.js.map