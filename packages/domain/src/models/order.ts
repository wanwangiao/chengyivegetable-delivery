import { z } from 'zod';

export const ORDER_STATUSES = [
  'pending',
  'preparing',
  'ready',
  'delivering',
  'delivered',
  'problem',
  'cancelled'
] as const;

export type OrderStatus = typeof ORDER_STATUSES[number];

export const orderStatusFlow: Record<OrderStatus, OrderStatus[]> = {
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
  createdAt: z.union([z.string(), z.date()]).optional(),
  updatedAt: z.union([z.string(), z.date()]).optional()
});

export type Order = z.infer<typeof OrderSchema>;

export const canTransition = (from: OrderStatus, to: OrderStatus): boolean => {
  return orderStatusFlow[from].includes(to);
};

export class OrderEntity {
  private readonly state: Order;

  constructor(order: Order) {
    this.state = OrderSchema.parse(order);
  }

  get snapshot(): Order {
    return this.state;
  }

  canTransitionTo(status: OrderStatus): boolean {
    return canTransition(this.state.status, status);
  }
}
