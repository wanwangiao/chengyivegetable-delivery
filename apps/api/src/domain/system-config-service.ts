import { z } from 'zod';
import type { SystemConfigRepository, SystemConfigUpdateInput } from '../infrastructure/prisma/system-config.repository';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const updateSchema = z.object({
  storeName: z.string().min(1).optional(),
  storePhone: z.string().nullable().optional(),
  currentOrderStartTime: z.string().regex(timeRegex, 'Invalid time format (HH:mm)').optional(),
  currentOrderEndTime: z.string().regex(timeRegex, 'Invalid time format (HH:mm)').optional(),
  preOrderStartTime: z.string().regex(timeRegex, 'Invalid time format (HH:mm)').optional(),
  preOrderEndTime: z.string().regex(timeRegex, 'Invalid time format (HH:mm)').optional(),
  priceChangeThreshold: z.number().min(0).max(100).optional(),
  priceConfirmTimeout: z.number().int().min(1).max(180).optional(),
  lineNotificationEnabled: z.boolean().optional()
});

export class SystemConfigService {
  constructor(private readonly repository: SystemConfigRepository) {}

  async getConfig() {
    return await this.repository.getOrCreate();
  }

  async updateConfig(input: unknown) {
    const validated = updateSchema.parse(input);
    return await this.repository.update(validated as SystemConfigUpdateInput);
  }

  /**
   * 判斷當前時間是否在指定的時間範圍內
   */
  isTimeInRange(startTime: string, endTime: string, currentTime?: Date): boolean {
    const now = currentTime ?? new Date();
    const [currentHour, currentMinute] = [now.getHours(), now.getMinutes()];
    const currentMinutes = currentHour * 60 + currentMinute;

    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }

  /**
   * 判斷當前是否為當日接單時段
   */
  async isCurrentOrderTime(currentTime?: Date): Promise<boolean> {
    const config = await this.getConfig();
    return this.isTimeInRange(
      config.currentOrderStartTime,
      config.currentOrderEndTime,
      currentTime
    );
  }

  /**
   * 判斷當前是否為預訂單時段
   */
  async isPreOrderTime(currentTime?: Date): Promise<boolean> {
    const config = await this.getConfig();
    return this.isTimeInRange(
      config.preOrderStartTime,
      config.preOrderEndTime,
      currentTime
    );
  }

  /**
   * 取得配送日期（根據當前時間判斷）
   */
  async getDeliveryDate(currentTime?: Date): Promise<{ deliveryDate: Date; isPreOrder: boolean }> {
    const now = currentTime ?? new Date();
    const isPreOrder = await this.isPreOrderTime(now);

    const deliveryDate = new Date(now);
    deliveryDate.setHours(0, 0, 0, 0);

    if (isPreOrder) {
      // 預訂單 → 隔天配送
      deliveryDate.setDate(deliveryDate.getDate() + 1);
    }

    return { deliveryDate, isPreOrder };
  }
}
