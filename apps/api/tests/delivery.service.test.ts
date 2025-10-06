import { describe, expect, it, beforeEach, vi } from 'vitest';
import { DeliveryService } from '../src/domain/delivery-service';
import type { DeliveryConfigRecord } from '../src/infrastructure/prisma/delivery.repository';

const buildConfig = (overrides?: Partial<DeliveryConfigRecord>): DeliveryConfigRecord => ({
  id: 'delivery-config',
  pickupName: '測試取貨點',
  pickupAddress: '台中市北區',
  pickupLat: 24.162,
  pickupLng: 120.685,
  recommendedBatchMin: 5,
  recommendedBatchMax: 8,
  autoBatchingEnabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
});

describe('DeliveryService', () => {
  const orderRepository = {
    findManyByIds: vi.fn(),
    updateCoordinates: vi.fn(),
    listByStatuses: vi.fn()
  } as any;
  const driverRepository = {
    list: vi.fn()
  } as any;
  const deliveryConfigRepository = {
    getConfig: vi.fn(),
    saveConfig: vi.fn()
  } as any;

  const createService = () =>
    new DeliveryService({
      orderRepository,
      driverRepository,
      deliveryConfigRepository
    });

  beforeEach(() => {
    vi.clearAllMocks();
    deliveryConfigRepository.getConfig.mockResolvedValue(buildConfig());
    driverRepository.list.mockResolvedValue([]);
    orderRepository.listByStatuses.mockResolvedValue([]);
  });

  it('throws when orderIds is empty', async () => {
    const service = createService();
    await expect(service.planRoute([])).rejects.toThrow('NO_ORDERS_SELECTED');
  });

  it('throws when pickup location not configured', async () => {
    deliveryConfigRepository.getConfig.mockResolvedValue(
      buildConfig({ pickupLat: 0, pickupLng: 0 })
    );
    orderRepository.findManyByIds.mockResolvedValue([]);

    const service = createService();
    await expect(service.planRoute(['00000000-0000-0000-0000-000000000000'])).rejects.toThrow(
      'PICKUP_LOCATION_NOT_CONFIGURED'
    );
  });

  it('returns route plan ordered by nearest distance', async () => {
    deliveryConfigRepository.getConfig.mockResolvedValue(buildConfig());
    const orders = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        contactName: '甲客戶',
        address: 'A 地址',
        latitude: 24.17,
        longitude: 120.69
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        contactName: '乙客戶',
        address: 'B 地址',
        latitude: 24.18,
        longitude: 120.7
      }
    ];

    orderRepository.findManyByIds.mockResolvedValue(
      orders.map(order => ({
        ...order,
        contactPhone: '0900000000',
        status: 'ready',
        subtotal: 0,
        deliveryFee: 0,
        totalAmount: 0,
        paymentMethod: 'cash',
        items: [],
        notes: null,
        driverId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }))
    );

    const service = createService();
    const result = await service.planRoute(orders.map(order => order.id));

    expect(result.stops).toHaveLength(2);
    expect(result.totalDistanceMeters).toBeGreaterThan(0);
    expect(result.stops[0].sequence).toBe(1);
    expect(result.stops[1].sequence).toBe(2);
  });

  it('builds recommended batches within configured min/max', async () => {
    const config = buildConfig({ recommendedBatchMin: 2, recommendedBatchMax: 3 });
    deliveryConfigRepository.getConfig.mockResolvedValue(config);

    const orders = Array.from({ length: 5 }).map((_, index) => ({
      id: `00000000-0000-0000-0000-00000000000${index}`,
      contactName: `客戶${index + 1}`,
      address: `測試地址 ${index + 1}`,
      status: 'ready',
      subtotal: 0,
      deliveryFee: 0,
      totalAmount: 100 + index,
      paymentMethod: 'cash',
      items: [],
      notes: null,
      driverId: null,
      contactPhone: '0900000000',
      latitude: 24.16 + index * 0.01,
      longitude: 120.68 + index * 0.01,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));

    orderRepository.listByStatuses.mockResolvedValue(orders);
    orderRepository.findManyByIds.mockImplementation(async (ids: string[]) =>
      orders.filter(order => ids.includes(order.id))
    );

    const service = createService();
    const result = await service.recommendBatches({ limit: 2 });

    expect(result.batches).toHaveLength(2);
    expect(result.leftovers).toHaveLength(0);
    expect(result.batches[0].orderCount).toBeGreaterThanOrEqual(2);
    expect(result.batches[0].orderCount).toBeLessThanOrEqual(3);
    expect(result.batches[0].totalAmount).toBeGreaterThan(0);
    expect(result.batches[0].preview?.stops.length).toBe(result.batches[0].orderCount);
  });
  it('produces map snapshot with caching', async () => {
    driverRepository.list.mockResolvedValue([
      {
        id: 'driver-1',
        name: '小王',
        phone: '0900-000-001',
        status: 'available',
        currentLat: 24.17,
        currentLng: 120.69,
        lastLocationUpdate: new Date('2024-01-01T00:00:00Z')
      }
    ]);

    orderRepository.listByStatuses.mockResolvedValue([
      {
        id: 'order-ready',
        contactName: '客戶甲',
        address: '台中市北區',
        status: 'ready',
        latitude: 24.18,
        longitude: 120.7,
        contactPhone: '0900-123-456',
        items: [],
        subtotal: 0,
        deliveryFee: 0,
        totalAmount: 200,
        paymentMethod: 'cash',
        notes: null,
        driverId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'order-delivering',
        contactName: '客戶乙',
        address: '台中市西區',
        status: 'delivering',
        latitude: 24.19,
        longitude: 120.71,
        contactPhone: '0900-789-012',
        items: [],
        subtotal: 0,
        deliveryFee: 0,
        totalAmount: 320,
        paymentMethod: 'cash',
        notes: null,
        driverId: 'driver-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]);

    const service = createService();
    const snapshot = await service.mapSnapshot({ force: true, ttlMs: 1_000, pollingIntervalSeconds: 45 });

    expect(snapshot.drivers).toHaveLength(1);
    expect(snapshot.orders.ready).toHaveLength(1);
    expect(snapshot.orders.delivering).toHaveLength(1);
    expect(snapshot.recommendedPollingIntervalSeconds).toBe(45);

    driverRepository.list.mockClear();

    const cached = await service.mapSnapshot();
    expect(driverRepository.list).not.toHaveBeenCalled();
    expect(cached.generatedAt).toBe(snapshot.generatedAt);
  });

});
