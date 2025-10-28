import type { Request, Response } from 'express';
import { SystemConfigService } from '../../domain/system-config-service';
import { PriceAlertAutoAcceptService } from '../../domain/price-alert-auto-accept-service';
import { uploadToCloudinary } from '../../infrastructure/storage/cloudinary-product-image.storage';

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

  uploadLogo = async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: '請上傳檔案' });
      return;
    }

    try {
      // 上傳到 Cloudinary (會自動存在 products 資料夾)
      const { imageUrl } = await uploadToCloudinary(file);

      // 更新系統設定中的 logo
      const config = await this.systemConfigService.updateConfig({
        storeLogo: imageUrl
      });

      res.json({
        success: true,
        data: {
          logoUrl: config.storeLogo,
          message: 'LOGO 上傳成功'
        }
      });
    } catch (error) {
      console.error('LOGO 上傳失敗:', error);
      res.status(500).json({ error: 'LOGO 上傳失敗，請稍後再試' });
    }
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
