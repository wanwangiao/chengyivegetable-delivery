import type { Request, Response } from 'express';
import { DeliveryService } from '../../domain/delivery-service';

export class DriverDeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  recommendedBatches = async (req: Request, res: Response) => {
    try {
      const limitRaw = req.query?.limit;
      const limit = typeof limitRaw === 'string' ? Number(limitRaw) : undefined;
      const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(10, Math.floor(limit as number))) : undefined;

      const result = await this.deliveryService.recommendBatches(safeLimit ? { limit: safeLimit } : undefined);
      res.json({ data: result });
    } catch (error: any) {
      if (error instanceof Error) {
        const mapping: Record<string, number> = {
          PICKUP_LOCATION_NOT_CONFIGURED: 412,
          ORDER_COORDINATES_MISSING: 412,
          GOOGLE_MAPS_API_KEY_NOT_CONFIGURED: 503
        };
        const status = mapping[error.message];
        if (status) {
          return res.status(status).json({ error: error.message });
        }
      }

      res.status(500).json({ error: 'UNEXPECTED_ERROR' });
    }
  };
}
