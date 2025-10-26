import type { Order } from '@chengyi/domain';
import type { OrderService } from './order-service';
import type { OrderRepository } from '../infrastructure/prisma/order.repository';
import type { DeliveryProofRepository } from '../infrastructure/prisma/delivery-proof.repository';
import type { Express } from 'express';
import { saveDeliveryProofImage } from '../infrastructure/storage/delivery-proof.storage';

export class DriverOrdersService {
  constructor(
    private readonly dependencies: {
      orderRepository: OrderRepository;
      orderService: OrderService;
      deliveryProofRepository: DeliveryProofRepository;
    }
  ) {}

  async listActiveOrders(driverId: string): Promise<Order[]> {
    return await this.dependencies.orderRepository.listByDriver(driverId, {
      statuses: ['delivering']
    });
  }

  async listAvailableOrders(): Promise<Order[]> {
    return await this.dependencies.orderRepository.listByStatuses(['ready']);
  }

  async listCompletedOrders(driverId: string, limit = 20): Promise<Order[]> {
    return await this.dependencies.orderRepository.listByDriver(driverId, {
      statuses: ['delivered'],
      limit
    });
  }

  async listProblemOrders(driverId: string, limit = 20): Promise<Order[]> {
    return await this.dependencies.orderRepository.listByDriver(driverId, {
      statuses: ['problem'],
      limit
    });
  }

  async getOrderForDriver(driverId: string, orderId: string): Promise<Order> {
    const order = await this.dependencies.orderRepository.findById(orderId);
    if (!order) {
      throw new Error('ORDER_NOT_FOUND');
    }
    if (order.driverId !== driverId) {
      throw new Error('ORDER_NOT_ASSIGNED_TO_DRIVER');
    }

    return order;
  }

  async claimOrder(orderId: string, actor: { sub: string; role: string }): Promise<Order> {
    return await this.dependencies.orderService.updateStatus(orderId, 'delivering', undefined, actor);
  }

  async claimBatch(orderIds: string[], actor: { sub: string; role: string }): Promise<Order[]> {
    // Claim all orders in the batch
    const results = await Promise.allSettled(
      orderIds.map(orderId => this.dependencies.orderService.updateStatus(orderId, 'delivering', undefined, actor))
    );

    const claimed: Order[] = [];
    const errors: string[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        claimed.push(result.value);
      } else {
        errors.push(`Order ${orderIds[index]}: ${result.reason?.message ?? 'Unknown error'}`);
      }
    });

    if (claimed.length === 0) {
      throw new Error('BATCH_CLAIM_FAILED: ' + errors.join(', '));
    }

    return claimed;
  }

  async markDelivered(orderId: string, actor: { sub: string; role: string }): Promise<Order> {
    return await this.dependencies.orderService.updateStatus(orderId, 'delivered', undefined, actor);
  }

  async markProblem(
    orderId: string,
    reason: string,
    actor: { sub: string; role: string }
  ): Promise<Order> {
    if (typeof reason !== 'string' || reason.trim().length === 0) {
      throw new Error('REASON_REQUIRED');
    }

    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      throw new Error('REASON_TOO_SHORT');
    }
    if (trimmed.length > 200) {
      throw new Error('REASON_TOO_LONG');
    }

    return await this.dependencies.orderService.updateStatus(orderId, 'problem', trimmed, actor);
  }

  async saveDeliveryProof(
    driverId: string,
    orderId: string,
    file: Express.Multer.File | undefined
  ) {
    if (!file) {
      throw new Error('PROOF_FILE_REQUIRED');
    }

    const order = await this.dependencies.orderRepository.findById(orderId);
    if (!order) {
      throw new Error('ORDER_NOT_FOUND');
    }
    if (order.driverId !== driverId) {
      throw new Error('ORDER_NOT_ASSIGNED_TO_DRIVER');
    }

    const saved = await saveDeliveryProofImage(file);
    const record = await this.dependencies.deliveryProofRepository.create({
      orderId,
      driverId,
      imageKey: saved.imageKey
    });

    return {
      id: record.id,
      orderId: record.orderId,
      driverId: record.driverId,
      imageUrl: saved.imageUrl,
      createdAt: record.createdAt.toISOString()
    };
  }

  async reorderActiveOrders(
    driverId: string,
    sequences: Array<{ orderId: string; sequence: number }>
  ): Promise<Order[]> {
    if (sequences.length === 0) {
      return await this.listActiveOrders(driverId);
    }

    const uniqueIds = Array.from(new Set(sequences.map(seq => seq.orderId)));
    const orders = await this.dependencies.orderRepository.findManyByIds(uniqueIds);

    if (orders.length !== uniqueIds.length) {
      throw new Error('ORDER_NOT_FOUND');
    }

    const notAssigned = orders.find(order => order.driverId !== driverId);
    if (notAssigned) {
      throw new Error('ORDER_NOT_ASSIGNED_TO_DRIVER');
    }

    const normalized = sequences.map((seq, index) => ({
      orderId: seq.orderId,
      sequence: Number.isFinite(seq.sequence) ? seq.sequence : index + 1
    }));

    await this.dependencies.orderRepository.updateDriverSequences(driverId, normalized);

    const updated = await this.listActiveOrders(driverId);
    return updated.sort(
      (a, b) =>
        (a.driverSequence ?? Number.MAX_SAFE_INTEGER) - (b.driverSequence ?? Number.MAX_SAFE_INTEGER)
    );
  }
}
