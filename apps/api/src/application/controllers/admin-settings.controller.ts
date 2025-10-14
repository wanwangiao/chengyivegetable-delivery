import type { Request, Response } from 'express';
import { SystemConfigService } from '../../domain/system-config-service';
import { PriceAlertAutoAcceptService } from '../../domain/price-alert-auto-accept-service';

export class AdminSettingsController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  getConfig = async (_req: Request, res: Response) => {
    const config = await this.systemConfigService.getConfig();
    res.json({ data: config });
  };

  updateConfig = async (req: Request, res: Response) => {
    const config = await this.systemConfigService.updateConfig(req.body);
    res.json({ data: config });
  };

  processTimeoutAlerts = async (_req: Request, res: Response) => {
    const service = new PriceAlertAutoAcceptService();
    const result = await service.processTimeoutAlerts();

    res.json({
      success: true,
      processed: result.processed,
      accepted: result.accepted,
      message: `已處理 ${result.processed} 筆通知，自動接受 ${result.accepted} 筆`
    });
  };
}
