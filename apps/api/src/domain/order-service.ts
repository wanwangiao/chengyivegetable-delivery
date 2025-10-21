import { randomUUID } from 'node:crypto';
import type { Order, OrderStatus } from '@chengyi/domain';
import { OrderEntity, OrderSchema } from '@chengyi/domain';
import type { OrderRepository } from '../infrastructure/prisma/order.repository';
import { createOrderStatusChangedEvent } from '@chengyi/domain';
import { eventBus } from '@chengyi/lib';
import { SystemConfigService } from './system-config-service';
import { prismaSystemConfigRepository } from '../infrastructure/prisma/system-config.repository';
import { prisma } from '../infrastructure/prisma/client';
import type { Prisma } from '@prisma/client';
import type { BusinessHoursService } from './business-hours.service';

export class OrderService {
  private systemConfigService: SystemConfigService;

  constructor(
    private readonly repository: OrderRepository,
    private readonly businessHoursService?: BusinessHoursService
  ) {
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

  /**
   * 建立訂單並扣減庫存（使用 transaction 確保原子性）
   */
  async createWithInventory(input: Omit<Order, 'id' | 'status'>): Promise<Order> {
    // 0. 營業時間驗證（在 transaction 外執行）
    let deliveryDate: Date;
    let isPreOrder: boolean;

    if (this.businessHoursService) {
      // 使用新的營業時間系統
      const validation = await this.businessHoursService.validateOrderTiming();

      if (!validation.valid) {
        throw new Error(`ORDER_TIME_INVALID: ${validation.message}`);
      }

      // 根據 orderWindow 計算配送日期
      const now = new Date();
      deliveryDate = new Date(now);
      deliveryDate.setHours(0, 0, 0, 0);

      if (validation.orderWindow === 'NEXT_DAY') {
        deliveryDate.setDate(deliveryDate.getDate() + 1);
        isPreOrder = true;
      } else if (validation.orderWindow === 'CURRENT_DAY') {
        isPreOrder = false;
      } else {
        throw new Error(`ORDER_TIME_INVALID: ${validation.message}`);
      }
    } else {
      // 向後兼容：使用舊的系統配置
      const result = await this.systemConfigService.getDeliveryDate();
      deliveryDate = result.deliveryDate;
      isPreOrder = result.isPreOrder;
    }

    // 使用 Prisma transaction 確保原子性
    const saved = await prisma.$transaction(async (tx) => {
      // 1. 價格驗證（使用 tx）
      await this.validateOrderPrices(input.items, tx);

      // 2. 驗證運費計算
      const subtotal = input.items.reduce((sum, item) =>
        sum + (Number(item.unitPrice) * item.quantity), 0
      );

      const expectedDeliveryFee = subtotal >= 200 ? 0 : 60;
      if (Math.abs(Number(input.deliveryFee) - expectedDeliveryFee) > 0.01) {
        throw new Error(
          `DELIVERY_FEE_MISMATCH: Expected ${expectedDeliveryFee}, Got ${input.deliveryFee}`
        );
      }

      // 3. 驗證訂單總金額
      const expectedTotalAmount = subtotal + expectedDeliveryFee;
      if (Math.abs(Number(input.totalAmount) - expectedTotalAmount) > 0.01) {
        throw new Error(
          `TOTAL_AMOUNT_MISMATCH: Expected ${expectedTotalAmount}, Got ${input.totalAmount}`
        );
      }

      // 4. 檢查並鎖定庫存
      for (const item of input.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { stock: true, name: true }
        });

        if (!product) {
          throw new Error(`PRODUCT_NOT_FOUND: ${item.productId}`);
        }

        if (product.stock < item.quantity) {
          throw new Error(
            `INSUFFICIENT_STOCK: ${product.name} ` +
            `(available: ${product.stock}, requested: ${item.quantity})`
          );
        }

        // 5. 扣減庫存
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.quantity
            }
          }
        });
      }

      // 6. 使用之前驗證得到的配送日期
      // deliveryDate 和 isPreOrder 已在上面計算

      // 7. 建立訂單
      const order = OrderSchema.parse({
        ...input,
        id: randomUUID(),
        status: 'pending',
        deliveryDate: deliveryDate.toISOString(),
        isPreOrder
      });

      const orderData = {
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
        deliveryDate:
          order.deliveryDate !== undefined
            ? typeof order.deliveryDate === 'string'
              ? new Date(order.deliveryDate)
              : order.deliveryDate
            : new Date(),
        isPreOrder: order.isPreOrder ?? false,
        priceAlertSent: order.priceAlertSent ?? false,
        priceConfirmed: order.priceConfirmed ?? undefined,
        priceAlertSentAt:
          order.priceAlertSentAt !== undefined
            ? typeof order.priceAlertSentAt === 'string'
              ? new Date(order.priceAlertSentAt)
              : order.priceAlertSentAt
            : undefined,
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
      };

      const created = await tx.order.create({
        data: orderData,
        include: {
          items: true,
          deliveryProofs: true
        }
      });

      // 將資料庫格式轉換為 Domain 格式
      return {
        id: created.id,
        contactName: created.contactName,
        contactPhone: created.contactPhone,
        address: created.address,
        latitude: created.latitude ?? undefined,
        longitude: created.longitude ?? undefined,
        geocodedAt: created.geocodedAt?.toISOString?.() ?? created.geocodedAt ?? undefined,
        status: created.status as OrderStatus,
        items: created.items.map((item: any) => ({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: Number(item.unitPrice),
          lineTotal: Number(item.lineTotal)
        })),
        subtotal: Number(created.subtotal),
        deliveryFee: Number(created.deliveryFee),
        totalAmount: Number(created.totalAmount),
        paymentMethod: created.paymentMethod as Order['paymentMethod'],
        notes: created.notes ?? undefined,
        driverId: created.driverId ?? undefined,
        deliveryDate: created.deliveryDate?.toISOString?.() ?? created.deliveryDate ?? undefined,
        isPreOrder: created.isPreOrder ?? false,
        priceAlertSent: created.priceAlertSent ?? false,
        priceConfirmed: created.priceConfirmed ?? undefined,
        priceAlertSentAt: created.priceAlertSentAt?.toISOString?.() ?? created.priceAlertSentAt ?? undefined,
        createdAt: created.createdAt?.toISOString?.() ?? created.createdAt ?? undefined,
        updatedAt: created.updatedAt?.toISOString?.() ?? created.updatedAt ?? undefined,
        deliveryProofs: undefined
      } as Order;
    });

    // transaction 完成後才發送事件
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

  /**
   * 價格驗證方法（支援 transaction）
   */
  private async validateOrderPrices(
    orderItems: Order['items'],
    tx: Prisma.TransactionClient
  ): Promise<boolean> {
    for (const item of orderItems) {
      // 從資料庫查詢當前商品價格
      const product = await tx.product.findUnique({
        where: { id: item.productId },
        select: { price: true, name: true }
      });

      if (!product) {
        throw new Error(`PRODUCT_NOT_FOUND: ${item.productId}`);
      }

      // 驗證價格（允許 ±0.01 浮點數誤差）
      const dbPrice = product.price ? Number(product.price) : 0;
      const priceDiff = Math.abs(dbPrice - item.unitPrice);
      if (priceDiff > 0.01) {
        throw new Error(
          `PRICE_MISMATCH: Product ${product.name} price changed. ` +
          `Expected: ${dbPrice}, Got: ${item.unitPrice}`
        );
      }
    }

    return true;
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

  /**
   * 取消訂單並恢復庫存（使用 transaction 確保原子性）
   */
  async cancelOrderAndRestoreInventory(orderId: string, reason?: string): Promise<Order> {
    return await prisma.$transaction(async (tx) => {
      // 1. 查詢訂單
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true }
      });

      if (!order) {
        throw new Error('Order not found');
      }

      // 2. 檢查訂單狀態（只有 pending 或 preparing 狀態可取消並恢復庫存）
      if (!['pending', 'preparing'].includes(order.status)) {
        throw new Error(
          `Cannot restore inventory for order with status: ${order.status}. ` +
          `Only 'pending' and 'preparing' orders can have inventory restored.`
        );
      }

      // 3. 恢復庫存
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              increment: item.quantity
            }
          }
        });
      }

      // 4. 更新訂單狀態
      const data: Record<string, unknown> = {
        status: 'cancelled',
        statusHistory: {
          create: {
            status: 'cancelled',
            note: reason ?? 'Order cancelled and inventory restored'
          }
        }
      };

      await tx.order.update({
        where: { id: orderId },
        data
      });

      // 5. 查詢更新後的訂單
      const updated = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          items: true,
          deliveryProofs: true
        }
      });

      if (!updated) {
        throw new Error('Failed to retrieve updated order');
      }

      // 將資料庫格式轉換為 Domain 格式
      return {
        id: updated.id,
        contactName: updated.contactName,
        contactPhone: updated.contactPhone,
        address: updated.address,
        latitude: updated.latitude ?? undefined,
        longitude: updated.longitude ?? undefined,
        geocodedAt: updated.geocodedAt?.toISOString?.() ?? updated.geocodedAt ?? undefined,
        status: updated.status as OrderStatus,
        items: updated.items.map((item: any) => ({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: Number(item.unitPrice),
          lineTotal: Number(item.lineTotal)
        })),
        subtotal: Number(updated.subtotal),
        deliveryFee: Number(updated.deliveryFee),
        totalAmount: Number(updated.totalAmount),
        paymentMethod: updated.paymentMethod as Order['paymentMethod'],
        notes: updated.notes ?? undefined,
        driverId: updated.driverId ?? undefined,
        deliveryDate: updated.deliveryDate?.toISOString?.() ?? updated.deliveryDate ?? undefined,
        isPreOrder: updated.isPreOrder ?? false,
        priceAlertSent: updated.priceAlertSent ?? false,
        priceConfirmed: updated.priceConfirmed ?? undefined,
        priceAlertSentAt: updated.priceAlertSentAt?.toISOString?.() ?? updated.priceAlertSentAt ?? undefined,
        createdAt: updated.createdAt?.toISOString?.() ?? updated.createdAt ?? undefined,
        updatedAt: updated.updatedAt?.toISOString?.() ?? updated.updatedAt ?? undefined,
        deliveryProofs: undefined
      } as Order;
    });
  }
}
