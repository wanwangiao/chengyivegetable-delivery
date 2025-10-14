import type { Order, OrderStatus } from '@chengyi/domain';
import { prisma } from './client';

export interface OrderHistoryEntry {
  status: OrderStatus;
  note?: string | null;
  changedAt: Date;
}

export interface OrderRepository {
  findById(id: string): Promise<Order | null>;
  findByPhone(phone: string): Promise<Order[]>;
  getStatusHistory(id: string): Promise<OrderHistoryEntry[]>;
  create(order: Order): Promise<Order>;
  updateStatus(id: string, status: OrderStatus, reason?: string, driverId?: string | null): Promise<Order>;
  list(): Promise<Order[]>;
  listByStatuses(statuses: OrderStatus[], limit?: number): Promise<Order[]>;
  listRecentByStatus(status: OrderStatus, limit: number): Promise<Order[]>;
  findManyByIds(ids: string[]): Promise<Order[]>;
  updateCoordinates(
    id: string,
    coordinates: { latitude: number; longitude: number; geocodedAt?: Date }
  ): Promise<Order>;
  listByDriver(
    driverId: string,
    options?: { statuses?: OrderStatus[]; limit?: number }
  ): Promise<Order[]>;
}

const defaultOrderInclude = {
  items: true,
  deliveryProofs: true
} as const;

const mapDbOrderToDomain = (result: any): Order => ({
  id: result.id,
  contactName: result.contactName,
  contactPhone: result.contactPhone,
  address: result.address,
  latitude: result.latitude ?? undefined,
  longitude: result.longitude ?? undefined,
  geocodedAt: result.geocodedAt?.toISOString?.() ?? result.geocodedAt ?? undefined,
  status: result.status as OrderStatus,
  items: result.items.map((item: any) => ({
    productId: item.productId,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    unitPrice: Number(item.unitPrice),
    lineTotal: Number(item.lineTotal)
  })),
  subtotal: Number(result.subtotal),
  deliveryFee: Number(result.deliveryFee),
  totalAmount: Number(result.totalAmount),
  paymentMethod: result.paymentMethod as Order['paymentMethod'],
  notes: result.notes ?? undefined,
  driverId: result.driverId ?? undefined,
  createdAt: result.createdAt?.toISOString?.() ?? result.createdAt ?? undefined,
  updatedAt: result.updatedAt?.toISOString?.() ?? result.updatedAt ?? undefined,
  deliveryProofs:
    result.deliveryProofs && result.deliveryProofs.length > 0
      ? result.deliveryProofs.map((proof: any) => ({
          id: proof.id,
          orderId: proof.orderId,
          driverId: proof.driverId,
          imageUrl: `/uploads/delivery-proofs/${proof.imageKey}`,
          createdAt: proof.createdAt?.toISOString?.() ?? proof.createdAt ?? undefined
        }))
      : undefined
});

export const prismaOrderRepository: OrderRepository = {
  async findById(id) {
    const result = await prisma.order.findUnique({
      where: { id },
      include: defaultOrderInclude
    });

    if (!result) return null;

    return mapDbOrderToDomain(result);
  },

  async findByPhone(phone) {
    const results = await prisma.order.findMany({
      where: { contactPhone: phone },
      include: defaultOrderInclude,
      orderBy: { createdAt: 'desc' }
    });

    return results.map(mapDbOrderToDomain);
  },

  async getStatusHistory(id) {
    const records = await prisma.orderStatusHistory.findMany({
      where: { orderId: id },
      orderBy: { changedAt: 'asc' }
    });

    return records.map(record => ({
      status: record.status as OrderStatus,
      note: record.note,
      changedAt: record.changedAt
    }));
  },

  async create(order) {
    await prisma.order.create({
      data: {
        id: order.id,
        contactName: order.contactName,
        contactPhone: order.contactPhone,
        address: order.address,
        latitude: order.latitude ?? undefined,
        longitude: order.longitude ?? undefined,
        geocodedAt:
          order.geocodedAt !== undefined
            ? typeof order.geocodedAt === 'string'
              ? new Date(order.geocodedAt)
              : order.geocodedAt
            : undefined,
        status: order.status,
        subtotal: order.subtotal,
        deliveryFee: order.deliveryFee,
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod,
        notes: order.notes,
        driverId: order.driverId,
        items: {
          createMany: {
            data: order.items.map(item => ({
              productId: item.productId,
              name: item.name,
              quantity: item.quantity,
              unit: item.unit,
              unitPrice: item.unitPrice,
              lineTotal: item.lineTotal
            }))
          }
        },
        statusHistory: {
          create: {
            status: order.status,
            note: 'Order created'
          }
        }
      }
    });

    return (await this.findById(order.id)) as Order;
  },

  async updateStatus(id, status, reason, driverId) {
    const data: Record<string, unknown> = {
      status,
      statusHistory: {
        create: {
          status,
          note: reason
        }
      }
    };

    if (driverId !== undefined) {
      data.driverId = driverId;
    }

    await prisma.order.update({
      where: { id },
      data
    });

    return (await this.findById(id)) as Order;
  },

  async list() {
    const results = await prisma.order.findMany({
      include: defaultOrderInclude,
      orderBy: { createdAt: 'desc' }
    });

    return results.map(mapDbOrderToDomain);
  },

  async listByStatuses(statuses, limit) {
    const results = await prisma.order.findMany({
      where: {
        status: {
          in: statuses
        }
      },
      include: defaultOrderInclude,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: limit !== undefined ? limit : undefined
    });

    return results.map(mapDbOrderToDomain);
  },

  async listRecentByStatus(status, limit) {
    const results = await prisma.order.findMany({
      where: { status },
      include: defaultOrderInclude,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: limit
    });

    return results.map(mapDbOrderToDomain);
  },

  async findManyByIds(ids) {
    if (ids.length === 0) {
      return [];
    }

    const results = await prisma.order.findMany({
      where: {
        id: {
          in: ids
        }
      },
      include: defaultOrderInclude
    });

    return results.map(mapDbOrderToDomain);
  },

  async listByDriver(driverId, options) {
    const results = await prisma.order.findMany({
      where: {
        driverId,
        status: options?.statuses
          ? {
              in: options.statuses
            }
          : undefined
      },
      include: defaultOrderInclude,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: options?.limit
    });

    return results.map(mapDbOrderToDomain);
  },

  async updateCoordinates(id, { latitude, longitude, geocodedAt }) {
    await prisma.order.update({
      where: { id },
      data: {
        latitude,
        longitude,
        geocodedAt: geocodedAt ?? new Date()
      }
    });

    return (await this.findById(id)) as Order;
  }
};
