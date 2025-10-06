import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Order } from '@chengyi/domain';
import type { OrderRepository } from '../infrastructure/prisma/order.repository';
import type { DriverRepository } from '../infrastructure/prisma/driver.repository';
import type {
  DeliveryConfigRepository,
  DeliveryConfigRecord
} from '../infrastructure/prisma/delivery.repository';
import type { DistanceMatrixElement, GoogleMapsService, LatLng } from '../infrastructure/maps/google-maps.service';

const settingsSchema = z
  .object({
    pickupName: z.string().min(1),
    pickupAddress: z.string().min(1),
    pickupLat: z.number().refine(value => Math.abs(value) <= 90, 'INVALID_LATITUDE'),
    pickupLng: z.number().refine(value => Math.abs(value) <= 180, 'INVALID_LONGITUDE'),
    recommendedBatchMin: z.number().int().min(1),
    recommendedBatchMax: z.number().int().min(1),
    autoBatchingEnabled: z.boolean()
  })
  .refine(data => data.recommendedBatchMax >= data.recommendedBatchMin, {
    message: 'BATCH_MAX_LT_MIN',
    path: ['recommendedBatchMax']
  });

const AVERAGE_SPEED_MPS = 25_000 / 3_600; // 約 25km/h 的市區速度
const EARTH_RADIUS = 6_371_000; // 公尺

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const haversineDistance = (a: LatLng, b: LatLng) => {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);

  const aVal = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));

  return EARTH_RADIUS * c;
};

export interface MapSnapshotDriver {
  id: string;
  name: string;
  status: string;
  latitude?: number;
  longitude?: number;
  lastLocationUpdate?: string;
}

export interface MapSnapshotOrder {
  id: string;
  status: string;
  address: string;
  contactName: string;
  latitude?: number;
  longitude?: number;
  driverId?: string;
  updatedAt?: string | Date;
}

export interface MapSnapshot {
  generatedAt: string;
  recommendedPollingIntervalSeconds: number;
  drivers: MapSnapshotDriver[];
  orders: {
    ready: MapSnapshotOrder[];
    delivering: MapSnapshotOrder[];
  };
  counts: {
    drivers: number;
    readyOrders: number;
    deliveringOrders: number;
  };
}

export type DeliverySettingsInput = z.infer<typeof settingsSchema>;

export interface DeliverySettings extends DeliverySettingsInput {
  updatedAt: string;
}

export interface RoutePlanStop {
  orderId: string;
  sequence: number;
  address: string;
  contactName: string;
  latitude: number;
  longitude: number;
  estimatedDistanceMeters: number;
  estimatedDurationSeconds: number;
}

export interface RoutePlanResult {
  pickup: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  };
  stops: RoutePlanStop[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
}

export interface RecommendedOrderSummary {
  id: string;
  address: string;
  contactName: string;
  status: string;
  totalAmount: number;
  notes?: string;
  latitude?: number;
  longitude?: number;
}

export interface BatchRecommendation {
  id: string;
  orderIds: string[];
  orderCount: number;
  totalAmount: number;
  orders: RecommendedOrderSummary[];
  preview?: RoutePlanResult;
}

export interface BatchRecommendationResult {
  generatedAt: string;
  pickup: RoutePlanResult['pickup'];
  batches: BatchRecommendation[];
  leftovers: RecommendedOrderSummary[];
}

type MapsClient = Pick<GoogleMapsService, 'geocode' | 'distanceMatrix'>;

export class DeliveryService {
  constructor(
    private readonly dependencies: {
      orderRepository: OrderRepository;
      driverRepository: DriverRepository;
      deliveryConfigRepository: DeliveryConfigRepository;
      mapsService?: MapsClient;
    }
  ) {}

  private mapSnapshotCache:
    | {
        expiresAt: number;
        snapshot: MapSnapshot;
      }
    | undefined;

  async getSettings(): Promise<DeliverySettings> {
    const config = await this.dependencies.deliveryConfigRepository.getConfig();
    return this.mapConfigToSettings(config);
  }

  async updateSettings(input: unknown): Promise<DeliverySettings> {
    const parsed = settingsSchema.parse(input);

    const saved = await this.dependencies.deliveryConfigRepository.saveConfig({
      pickupName: parsed.pickupName,
      pickupAddress: parsed.pickupAddress,
      pickupLat: parsed.pickupLat,
      pickupLng: parsed.pickupLng,
      recommendedBatchMin: parsed.recommendedBatchMin,
      recommendedBatchMax: parsed.recommendedBatchMax,
      autoBatchingEnabled: parsed.autoBatchingEnabled
    });

    return this.mapConfigToSettings(saved);
  }

  async planRoute(orderIds: string[]): Promise<RoutePlanResult> {
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      throw new Error('NO_ORDERS_SELECTED');
    }

    const settings = await this.dependencies.deliveryConfigRepository.getConfig();
    if (
      !Number.isFinite(settings.pickupLat) ||
      !Number.isFinite(settings.pickupLng) ||
      (settings.pickupLat === 0 && settings.pickupLng === 0)
    ) {
      throw new Error('PICKUP_LOCATION_NOT_CONFIGURED');
    }
    const pickupLocation: LatLng = {
      lat: settings.pickupLat,
      lng: settings.pickupLng
    };

    const orders = await this.dependencies.orderRepository.findManyByIds(orderIds);

    if (orders.length !== orderIds.length) {
      throw new Error('ORDER_NOT_FOUND');
    }

    const enrichedOrders = await Promise.all(
      orders.map(async order => this.ensureCoordinates(order))
    );

    const remaining = enrichedOrders.map(order => ({
      order,
      coords: {
        lat: order.latitude as number,
        lng: order.longitude as number
      }
    }));

    const stops: RoutePlanStop[] = [];
    let current = pickupLocation;
    let totalDistance = 0;
    let totalDuration = 0;
    let sequence = 1;

    while (remaining.length > 0) {
      let nearestIndex = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;
      let nearestDuration = Number.POSITIVE_INFINITY;

      for (let index = 0; index < remaining.length; index += 1) {
        const candidate = remaining[index];
        const { distance, duration } = await this.estimateLeg(current, candidate.coords);

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestDuration = duration;
          nearestIndex = index;
        }
      }

      const next = remaining.splice(nearestIndex, 1)[0];

      stops.push({
        orderId: next.order.id,
        sequence,
        address: next.order.address,
        contactName: next.order.contactName,
        latitude: next.coords.lat,
        longitude: next.coords.lng,
        estimatedDistanceMeters: nearestDistance,
        estimatedDurationSeconds: nearestDuration
      });

      totalDistance += nearestDistance;
      totalDuration += nearestDuration;
      current = next.coords;
      sequence += 1;
    }

    return {
      pickup: {
        name: settings.pickupName,
        address: settings.pickupAddress,
        latitude: pickupLocation.lat,
        longitude: pickupLocation.lng
      },
      stops,
      totalDistanceMeters: Math.round(totalDistance),
      totalDurationSeconds: Math.round(totalDuration)
    };
  }

  async recommendBatches(options?: { limit?: number }): Promise<BatchRecommendationResult> {
    const settings = await this.dependencies.deliveryConfigRepository.getConfig();
    if (
      !Number.isFinite(settings.pickupLat) ||
      !Number.isFinite(settings.pickupLng) ||
      (settings.pickupLat === 0 && settings.pickupLng === 0)
    ) {
      throw new Error('PICKUP_LOCATION_NOT_CONFIGURED');
    }

    const readyOrders = await this.dependencies.orderRepository.listByStatuses(['ready']);
    const sortedOrders = [...readyOrders].sort((a, b) => {
      const aTime = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
      const bTime = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
      return aTime - bTime;
    });

    const limit = options?.limit ?? 3;
    const pendingBatches: Order[][] = [];
    const leftovers: Order[] = [];
    let buffer: Order[] = [];

    for (const order of sortedOrders) {
      if (pendingBatches.length >= limit) {
        leftovers.push(order);
        continue;
      }

      buffer.push(order);
      if (buffer.length === settings.recommendedBatchMax) {
        pendingBatches.push(buffer);
        buffer = [];
      }
    }

    if (buffer.length > 0) {
      if (buffer.length >= settings.recommendedBatchMin && pendingBatches.length < limit) {
        pendingBatches.push(buffer);
      } else {
        leftovers.push(...buffer);
      }
    }

    const batches = await Promise.all(
      pendingBatches.map(async batchOrders => await this.buildBatchRecommendation(batchOrders))
    );

    const leftoverSummaries = leftovers.map(order => this.summariseOrder(order));

    return {
      generatedAt: new Date().toISOString(),
      pickup: {
        name: settings.pickupName,
        address: settings.pickupAddress,
        latitude: settings.pickupLat,
        longitude: settings.pickupLng
      },
      batches,
      leftovers: leftoverSummaries
    };
  }

  async mapSnapshot(options?: { force?: boolean; ttlMs?: number; pollingIntervalSeconds?: number }): Promise<MapSnapshot> {
    const ttlMs = options?.ttlMs ?? 60_000;
    const pollingIntervalSeconds = options?.pollingIntervalSeconds ?? 60;
    const now = Date.now();

    if (!options?.force && this.mapSnapshotCache && this.mapSnapshotCache.expiresAt > now) {
      return this.mapSnapshotCache.snapshot;
    }

    const [drivers, orders] = await Promise.all([
      this.dependencies.driverRepository.list(),
      this.dependencies.orderRepository.listByStatuses(['ready', 'delivering'])
    ]);

    const ready: MapSnapshotOrder[] = [];
    const delivering: MapSnapshotOrder[] = [];

    for (const order of orders) {
      const target = order.status === 'delivering' ? delivering : ready;
      target.push({
        id: order.id,
        status: order.status,
        address: order.address,
        contactName: order.contactName,
        latitude: order.latitude,
        longitude: order.longitude,
        driverId: order.driverId,
        updatedAt: order.updatedAt
      });
    }

    const snapshot: MapSnapshot = {
      generatedAt: new Date().toISOString(),
      recommendedPollingIntervalSeconds: pollingIntervalSeconds,
      drivers: drivers.map(driver => ({
        id: driver.id,
        name: driver.name,
        status: driver.status,
        latitude: driver.currentLat ?? undefined,
        longitude: driver.currentLng ?? undefined,
        lastLocationUpdate: driver.lastLocationUpdate?.toISOString?.()
      })),
      orders: {
        ready,
        delivering
      },
      counts: {
        drivers: drivers.length,
        readyOrders: ready.length,
        deliveringOrders: delivering.length
      }
    };

    this.mapSnapshotCache = {
      snapshot,
      expiresAt: now + ttlMs
    };

    return snapshot;
  }

  private mapConfigToSettings(config: DeliveryConfigRecord): DeliverySettings {
    return {
      pickupName: config.pickupName,
      pickupAddress: config.pickupAddress,
      pickupLat: config.pickupLat,
      pickupLng: config.pickupLng,
      recommendedBatchMin: config.recommendedBatchMin,
      recommendedBatchMax: config.recommendedBatchMax,
      autoBatchingEnabled: config.autoBatchingEnabled,
      updatedAt: config.updatedAt.toISOString()
    };
  }

  private async ensureCoordinates(order: Order): Promise<Order> {
    if (order.latitude !== undefined && order.longitude !== undefined) {
      return order;
    }

    if (!this.dependencies.mapsService) {
      throw new Error('ORDER_COORDINATES_MISSING');
    }

    const coords = await this.dependencies.mapsService.geocode(order.address);
    return await this.dependencies.orderRepository.updateCoordinates(order.id, {
      latitude: coords.lat,
      longitude: coords.lng,
      geocodedAt: new Date()
    });
  }

  private async estimateLeg(origin: LatLng, destination: LatLng): Promise<{ distance: number; duration: number }> {
    if (this.dependencies.mapsService) {
      try {
        const matrix = await this.dependencies.mapsService.distanceMatrix([origin], [destination]);
        const firstRow = matrix[0]?.[0];
        if (firstRow) {
          return this.normaliseMatrixElement(firstRow);
        }
      } catch (error) {
        // 若 Google API 呼叫失敗，退回內建估算避免整體流程中斷
      }
    }

    const distance = haversineDistance(origin, destination);
    const duration = distance / AVERAGE_SPEED_MPS;
    return { distance, duration };
  }

  private normaliseMatrixElement(element: DistanceMatrixElement): { distance: number; duration: number } {
    const distance = Number.isFinite(element.distanceInMeters)
      ? element.distanceInMeters
      : Number.POSITIVE_INFINITY;
    const duration = Number.isFinite(element.durationInSeconds)
      ? element.durationInSeconds
      : distance / AVERAGE_SPEED_MPS;
    return { distance, duration };
  }

  private summariseOrder(order: Order): RecommendedOrderSummary {
    return {
      id: order.id,
      address: order.address,
      contactName: order.contactName,
      status: order.status,
      totalAmount: order.totalAmount,
      notes: order.notes,
      latitude: order.latitude,
      longitude: order.longitude
    };
  }

  private async buildBatchRecommendation(orders: Order[]): Promise<BatchRecommendation> {
    const summaries = orders.map(order => this.summariseOrder(order));
    let preview: RoutePlanResult | undefined;

    try {
      preview = await this.planRoute(summaries.map(order => order.id));
    } catch (error: any) {
      if (error instanceof Error) {
        const ignorable = new Set([
          'ORDER_COORDINATES_MISSING',
          'GOOGLE_MAPS_API_KEY_NOT_CONFIGURED',
          'ORDER_NOT_FOUND'
        ]);
        if (!ignorable.has(error.message)) {
          throw error;
        }
      } else {
        throw error;
      }
    }

    const totalAmount = summaries.reduce((acc, order) => acc + Number(order.totalAmount ?? 0), 0);

    return {
      id: randomUUID(),
      orderIds: summaries.map(order => order.id),
      orderCount: summaries.length,
      totalAmount,
      orders: summaries,
      preview
    };
  }
}
