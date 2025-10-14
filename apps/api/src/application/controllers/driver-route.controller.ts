import { type Request, type Response } from 'express';
import { z } from 'zod';
import { GoogleMapsService } from '../../infrastructure/maps/google-maps.service';

const RouteRequestSchema = z.object({
  origin: z.object({
    lat: z.number(),
    lng: z.number()
  }),
  destination: z.object({
    lat: z.number(),
    lng: z.number()
  }),
  waypoints: z
    .array(
      z.object({
        lat: z.number(),
        lng: z.number()
      })
    )
    .optional()
});

export class DriverRouteController {
  constructor(private readonly mapsService?: GoogleMapsService) {}

  /**
   * 取得優化路線
   * POST /api/v1/drivers/routes/optimize
   */
  async getOptimizedRoute(req: Request, res: Response): Promise<void> {
    const data = RouteRequestSchema.parse(req.body);

    if (!this.mapsService) {
      res.status(503).json({
        error: 'MAPS_SERVICE_UNAVAILABLE',
        message: 'Google Maps 服務未啟用'
      });
      return;
    }

    try {
      const route = await this.mapsService.getOptimizedRoute(
        data.origin,
        data.destination,
        data.waypoints ?? []
      );

      res.json({
        data: {
          distance: route.distance,
          duration: route.duration,
          polyline: route.polyline,
          steps: route.steps
        }
      });
    } catch (error: any) {
      res.status(500).json({
        error: 'ROUTE_OPTIMIZATION_FAILED',
        message: error?.message ?? '路線規劃失敗'
      });
    }
  }

  /**
   * 批次計算配送順序建議
   * POST /api/v1/drivers/routes/batch-optimize
   */
  async getBatchOptimizedOrder(req: Request, res: Response): Promise<void> {
    const data = z
      .object({
        origin: z.object({ lat: z.number(), lng: z.number() }),
        destinations: z.array(
          z.object({
            id: z.string(),
            lat: z.number(),
            lng: z.number()
          })
        )
      })
      .parse(req.body);

    if (!this.mapsService) {
      res.status(503).json({
        error: 'MAPS_SERVICE_UNAVAILABLE',
        message: 'Google Maps 服務未啟用'
      });
      return;
    }

    try {
      // 使用 Google Maps Distance Matrix API 計算所有點之間的距離
      const optimizedOrder = await this.optimizeDeliveryOrder(
        data.origin,
        data.destinations
      );

      res.json({ data: optimizedOrder });
    } catch (error: any) {
      res.status(500).json({
        error: 'BATCH_OPTIMIZATION_FAILED',
        message: error?.message ?? '批次路線規劃失敗'
      });
    }
  }

  /**
   * 貪婪演算法：每次選擇距離當前位置最近的下一個目的地
   */
  private async optimizeDeliveryOrder(
    origin: { lat: number; lng: number },
    destinations: Array<{ id: string; lat: number; lng: number }>
  ): Promise<
    Array<{
      id: string;
      lat: number;
      lng: number;
      order: number;
      distanceFromPrevious: number;
      durationFromPrevious: number;
    }>
  > {
    if (!this.mapsService) {
      throw new Error('Maps service not available');
    }

    const remaining = [...destinations];
    const optimized: Array<{
      id: string;
      lat: number;
      lng: number;
      order: number;
      distanceFromPrevious: number;
      durationFromPrevious: number;
    }> = [];

    let currentPos = origin;
    let order = 1;

    while (remaining.length > 0) {
      // 計算當前位置到所有剩餘目的地的距離
      const distances = await Promise.all(
        remaining.map(async dest => {
          try {
            const route = await this.mapsService!.getRoute(currentPos, dest);
            return {
              destination: dest,
              distance: route.distance,
              duration: route.duration
            };
          } catch {
            // 如果 API 失敗，使用直線距離估算
            const distance = this.calculateHaversineDistance(currentPos, dest);
            return {
              destination: dest,
              distance,
              duration: distance / 500 // 假設平均速度 30 km/h = 500 m/min
            };
          }
        })
      );

      // 選擇最近的目的地
      const nearest = distances.reduce((min, curr) =>
        curr.distance < min.distance ? curr : min
      );

      optimized.push({
        id: nearest.destination.id,
        lat: nearest.destination.lat,
        lng: nearest.destination.lng,
        order,
        distanceFromPrevious: nearest.distance,
        durationFromPrevious: nearest.duration
      });

      // 移除已選擇的目的地
      const index = remaining.findIndex(d => d.id === nearest.destination.id);
      remaining.splice(index, 1);

      currentPos = nearest.destination;
      order++;
    }

    return optimized;
  }

  /**
   * Haversine 公式計算兩點間直線距離（公尺）
   */
  private calculateHaversineDistance(
    point1: { lat: number; lng: number },
    point2: { lat: number; lng: number }
  ): number {
    const R = 6371000; // 地球半徑（公尺）
    const lat1 = (point1.lat * Math.PI) / 180;
    const lat2 = (point2.lat * Math.PI) / 180;
    const deltaLat = ((point2.lat - point1.lat) * Math.PI) / 180;
    const deltaLng = ((point2.lng - point1.lng) * Math.PI) / 180;

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}
