import { z } from 'zod';
export declare const ORDER_STATUSES: readonly ["pending", "preparing", "ready", "delivering", "delivered", "problem", "cancelled"];
export type OrderStatus = typeof ORDER_STATUSES[number];
export declare const DeliveryProofSchema: z.ZodObject<{
    id: z.ZodString;
    orderId: z.ZodString;
    driverId: z.ZodString;
    imageUrl: z.ZodString;
    createdAt: z.ZodUnion<[z.ZodString, z.ZodDate]>;
}, "strip", z.ZodTypeAny, {
    id: string;
    driverId: string;
    createdAt: string | Date;
    orderId: string;
    imageUrl: string;
}, {
    id: string;
    driverId: string;
    createdAt: string | Date;
    orderId: string;
    imageUrl: string;
}>;
export type DeliveryProof = z.infer<typeof DeliveryProofSchema>;
export declare const orderStatusFlow: Record<OrderStatus, OrderStatus[]>;
export declare const OrderItemSchema: z.ZodObject<{
    productId: z.ZodString;
    name: z.ZodString;
    quantity: z.ZodNumber;
    unit: z.ZodString;
    unitPrice: z.ZodNumber;
    lineTotal: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    name: string;
    productId: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    lineTotal: number;
}, {
    name: string;
    productId: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    lineTotal: number;
}>;
export declare const OrderSchema: z.ZodObject<{
    id: z.ZodString;
    contactName: z.ZodString;
    contactPhone: z.ZodString;
    address: z.ZodString;
    latitude: z.ZodOptional<z.ZodEffects<z.ZodNumber, number, number>>;
    longitude: z.ZodOptional<z.ZodEffects<z.ZodNumber, number, number>>;
    geocodedAt: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
    status: z.ZodEnum<["pending", "preparing", "ready", "delivering", "delivered", "problem", "cancelled"]>;
    items: z.ZodArray<z.ZodObject<{
        productId: z.ZodString;
        name: z.ZodString;
        quantity: z.ZodNumber;
        unit: z.ZodString;
        unitPrice: z.ZodNumber;
        lineTotal: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string;
        productId: string;
        quantity: number;
        unit: string;
        unitPrice: number;
        lineTotal: number;
    }, {
        name: string;
        productId: string;
        quantity: number;
        unit: string;
        unitPrice: number;
        lineTotal: number;
    }>, "many">;
    subtotal: z.ZodNumber;
    deliveryFee: z.ZodNumber;
    totalAmount: z.ZodNumber;
    paymentMethod: z.ZodEnum<["cash", "transfer", "line_pay", "credit"]>;
    notes: z.ZodOptional<z.ZodString>;
    driverId: z.ZodOptional<z.ZodString>;
    deliveryDate: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
    isPreOrder: z.ZodOptional<z.ZodBoolean>;
    priceAlertSent: z.ZodOptional<z.ZodBoolean>;
    priceConfirmed: z.ZodOptional<z.ZodBoolean>;
    priceAlertSentAt: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
    createdAt: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
    updatedAt: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
    deliveryProofs: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        orderId: z.ZodString;
        driverId: z.ZodString;
        imageUrl: z.ZodString;
        createdAt: z.ZodUnion<[z.ZodString, z.ZodDate]>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        driverId: string;
        createdAt: string | Date;
        orderId: string;
        imageUrl: string;
    }, {
        id: string;
        driverId: string;
        createdAt: string | Date;
        orderId: string;
        imageUrl: string;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    status: "pending" | "preparing" | "ready" | "delivering" | "delivered" | "problem" | "cancelled";
    id: string;
    contactName: string;
    contactPhone: string;
    address: string;
    items: {
        name: string;
        productId: string;
        quantity: number;
        unit: string;
        unitPrice: number;
        lineTotal: number;
    }[];
    subtotal: number;
    deliveryFee: number;
    totalAmount: number;
    paymentMethod: "cash" | "transfer" | "line_pay" | "credit";
    latitude?: number | undefined;
    longitude?: number | undefined;
    geocodedAt?: string | Date | undefined;
    notes?: string | undefined;
    driverId?: string | undefined;
    deliveryDate?: string | Date | undefined;
    isPreOrder?: boolean | undefined;
    priceAlertSent?: boolean | undefined;
    priceConfirmed?: boolean | undefined;
    priceAlertSentAt?: string | Date | undefined;
    createdAt?: string | Date | undefined;
    updatedAt?: string | Date | undefined;
    deliveryProofs?: {
        id: string;
        driverId: string;
        createdAt: string | Date;
        orderId: string;
        imageUrl: string;
    }[] | undefined;
}, {
    status: "pending" | "preparing" | "ready" | "delivering" | "delivered" | "problem" | "cancelled";
    id: string;
    contactName: string;
    contactPhone: string;
    address: string;
    items: {
        name: string;
        productId: string;
        quantity: number;
        unit: string;
        unitPrice: number;
        lineTotal: number;
    }[];
    subtotal: number;
    deliveryFee: number;
    totalAmount: number;
    paymentMethod: "cash" | "transfer" | "line_pay" | "credit";
    latitude?: number | undefined;
    longitude?: number | undefined;
    geocodedAt?: string | Date | undefined;
    notes?: string | undefined;
    driverId?: string | undefined;
    deliveryDate?: string | Date | undefined;
    isPreOrder?: boolean | undefined;
    priceAlertSent?: boolean | undefined;
    priceConfirmed?: boolean | undefined;
    priceAlertSentAt?: string | Date | undefined;
    createdAt?: string | Date | undefined;
    updatedAt?: string | Date | undefined;
    deliveryProofs?: {
        id: string;
        driverId: string;
        createdAt: string | Date;
        orderId: string;
        imageUrl: string;
    }[] | undefined;
}>;
export type Order = z.infer<typeof OrderSchema>;
export declare const canTransition: (from: OrderStatus, to: OrderStatus) => boolean;
export declare class OrderEntity {
    private readonly state;
    constructor(order: Order);
    get snapshot(): Order;
    canTransitionTo(status: OrderStatus): boolean;
}
//# sourceMappingURL=order.d.ts.map