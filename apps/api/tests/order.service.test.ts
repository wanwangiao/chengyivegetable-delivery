import { describe, expect, it, vi } from 'vitest';
import { OrderService } from '../src/domain/order-service';
import type { OrderRepository } from '../src/infrastructure/prisma/order.repository';

const repository = {
  list: vi.fn(async () => []),
  findById: vi.fn(async () => null),
  findByPhone: vi.fn(async () => []),
  getStatusHistory: vi.fn(async () => []),
  create: vi.fn(),
  updateStatus: vi.fn()
} satisfies Partial<OrderRepository> as OrderRepository;

describe('OrderService', () => {
  const service = new OrderService(repository);

  it('rejects invalid transitions', async () => {
    const orderId = 'cbe8c0c4-4a1c-4f2d-8ed0-0b6e0bfb5f10';

    repository.findById = vi.fn(async () => ({
      id: orderId,
      contactName: '測試顧客',
      contactPhone: '0912345678',
      address: '高雄市',
      status: 'pending',
      items: [],
      subtotal: 0,
      deliveryFee: 0,
      totalAmount: 0,
      paymentMethod: 'cash'
    }));

    await expect(service.updateStatus(orderId, 'delivering')).rejects.toThrow('Invalid transition');
  });

  it('returns orders by phone', async () => {
    repository.findByPhone = vi.fn(async () => [
      {
        id: 'd873cb0a-3a7e-417c-8f37-4a090c7c6f79',
        contactName: '再次測試',
        contactPhone: '0912345678',
        address: '高雄市',
        status: 'pending',
        items: [],
        subtotal: 0,
        deliveryFee: 0,
        totalAmount: 0,
        paymentMethod: 'cash'
      }
    ]);

    const result = await service.searchByPhone('0912345678');
    expect(result).toHaveLength(1);
  });
});
