import { randomUUID } from 'node:crypto';
import type { Order, OrderStatus } from '@chengyi/domain';
import { OrderEntity, OrderSchema } from '@chengyi/domain';
import type { OrderRepository } from '../infrastructure/prisma/order.repository';
import { createOrderStatusChangedEvent } from '@chengyi/domain';
import { eventBus } from '@chengyi/lib';
import { SystemConfigService } from './system-config-service';
import { prismaSystemConfigRepository } from '../infrastructure/prisma/system-config.repository';

export class OrderService {
  private systemConfigService: SystemConfigService;

  constructor(private readonly repository: OrderRepository) {
    this.systemConfigService = new SystemConfigService(prismaSystemConfigRepository);
  }

  async list(): Promise<Order[]> {
    return await this.repository.list();
  }

  async findById(id: string): Promise<Order | null> {
    return await this.repository.findById(id);
  }

  async searchByPhone(phone: string): Promise<Order[]> {
    return await this.repository.findByPhone(phone);
  }

  async getHistory(id: string) {
    const history = await this.repository.getStatusHistory(id);
    return history.map(entry => ({
      status: entry.status,
      note: entry.note ?? undefined,
      changedAt: entry.changedAt
    }));
  }

  async create(input: Omit<Order, 'id' | 'status'>): Promise<Order> {
    // 取得配送日期和預訂單標記
    const { deliveryDate, isPreOrder } = await this.systemConfigService.getDeliveryDate();

    const order = OrderSchema.parse({
      ...input,
      id: randomUUID(),
      status: 'pending',
      deliveryDate: deliveryDate.toISOString(),
      isPreOrder
    });

    const saved = await this.repository.create(order);

    eventBus.emit('order.created', {
      orderId: saved.id,
      phone: saved.contactPhone,
      contactName: saved.contactName,
      totalAmount: saved.totalAmount,
      deliveryDate: saved.deliveryDate,
      isPreOrder: saved.isPreOrder
    });

    return saved;
  }

  async updateStatus(
    id: string,
    status: OrderStatus,
    reason?: string,
    actor?: { sub: string; role: string }
  ): Promise<Order> {
    const current = await this.repository.findById(id);
    if (!current) {
      throw new Error('Order not found');
    }

    const entity = new OrderEntity(current);
    if (!entity.canTransitionTo(status)) {
      throw new Error(`Invalid transition from ${current.status} to ${status}`);
    }

    let driverIdToSet: string | undefined | null = undefined;

    if (actor?.role === 'DRIVER') {
      const driverId = actor.sub;
      const alreadyAssignedToDriver = current.driverId === driverId;
      const assignedToAnotherDriver = current.driverId && current.driverId !== driverId;

      if (assignedToAnotherDriver) {
        throw new Error('ORDER_ALREADY_CLAIMED');
      }

      const isClaimingFlow = ['delivering', 'delivered'].includes(status);
      if (!alreadyAssignedToDriver && isClaimingFlow) {
        driverIdToSet = driverId;
      } else if (!alreadyAssignedToDriver) {
        throw new Error('ORDER_NOT_ASSIGNED_TO_DRIVER');
      }
    }

    if (actor?.role === 'ADMIN' && status === 'pending') {
      driverIdToSet = null;
    }

    const updated = await this.repository.updateStatus(id, status, reason, driverIdToSet);

    // 觸發狀態變更事件（整合 audit log 和 LINE 通知所需資訊）
    eventBus.emit('order.status-changed', {
      ...createOrderStatusChangedEvent({
        orderId: id,
        previousStatus: current.status,
        newStatus: status,
        reason
      }),
      // 額外的 LINE 通知所需資訊
      phone: updated.contactPhone,
      status: updated.status,
      note: reason,
      driverId: driverIdToSet
    });

    return updated;
  }
}
