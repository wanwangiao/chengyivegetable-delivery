import type { Request, Response } from 'express';
import { DeliveryService } from '../../domain/delivery-service';

const parseBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalised = value.toLowerCase();
    if (['1', 'true', 'yes', 'y'].includes(normalised)) return true;
    if (['0', 'false', 'no', 'n'].includes(normalised)) return false;
  }
  return undefined;
};

const parseNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

export class AdminDeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  getSettings = async (_req: Request, res: Response) => {
    const settings = await this.deliveryService.getSettings();
    res.json({ data: settings });
  };

  updateSettings = async (req: Request, res: Response) => {
    try {
      const updated = await this.deliveryService.updateSettings(req.body);
      res.json({ data: updated });
    } catch (error: any) {
      res.status(400).json({ error: 'INVALID_SETTINGS', message: error?.message ?? '設定格式錯誤' });
    }
  };

  planRoute = async (req: Request, res: Response) => {
    const orderIds = Array.isArray(req.body?.orderIds) ? req.body.orderIds : [];

    if (!orderIds.length || !orderIds.every((id: unknown) => typeof id === 'string')) {
      return res.status(400).json({ error: 'INVALID_ORDER_IDS', message: '請提供訂單 ID 陣列' });
    }

    try {
      const result = await this.deliveryService.planRoute(orderIds as string[]);
      res.json({ data: result });
    } catch (error: any) {
      const mapping: Record<string, number> = {
        NO_ORDERS_SELECTED: 400,
        ORDER_NOT_FOUND: 404,
        PICKUP_LOCATION_NOT_CONFIGURED: 412
      };
      const status = mapping[error?.message as string] ?? 500;
      res.status(status).json({ error: error?.message ?? 'UNEXPECTED_ERROR' });
    }
  };

  mapSnapshot = async (req: Request, res: Response) => {
    const force = parseBoolean(req.query.force);
    const ttlMs = parseNumber(req.query.ttlMs);
    const pollingIntervalSeconds = parseNumber(req.query.pollingIntervalSeconds);

    const snapshot = await this.deliveryService.mapSnapshot({
      force,
      ttlMs,
      pollingIntervalSeconds
    });

    res.json({ data: snapshot });
  };

  recommendedBatches = async (req: Request, res: Response) => {
    const limit = parseNumber(req.query.limit);
    const safeLimit = limit && limit > 0 ? Math.min(Math.floor(limit), 20) : undefined;

    try {
      const batches = await this.deliveryService.recommendBatches(safeLimit ? { limit: safeLimit } : undefined);
      res.json({ data: batches });
    } catch (error: any) {
      const mapping: Record<string, number> = {
        PICKUP_LOCATION_NOT_CONFIGURED: 412,
        ORDER_COORDINATES_MISSING: 412,
        GOOGLE_MAPS_API_KEY_NOT_CONFIGURED: 503
      };
      const status = mapping[error?.message as string] ?? 500;
      res.status(status).json({ error: error?.message ?? 'UNEXPECTED_ERROR' });
    }
  };
}
