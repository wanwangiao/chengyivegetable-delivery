import { BusinessHours, SpecialDate, DateType } from '@prisma/client';
import { BusinessHoursRepository, CreateSpecialDateDto, UpdateBusinessHoursDto } from '../infrastructure/prisma/business-hours.repository';
import { getTaiwanTime, getTaiwanDayOfWeek, getTaiwanTimeInMinutes } from '../utils/timezone';

export type OrderWindow = 'CURRENT_DAY' | 'NEXT_DAY' | 'CLOSED';

export interface BusinessStatus {
  isOpen: boolean;
  orderWindow: OrderWindow;
  message: string;
  nextOpenTime?: Date;
}

export class BusinessHoursService {
  constructor(private readonly repository: BusinessHoursRepository) {}

  /**
   * 獲取營業時間設定
   */
  async getBusinessHours(): Promise<BusinessHours> {
    return this.repository.getOrCreate();
  }

  /**
   * 更新營業時間設定
   */
  async updateBusinessHours(id: string, data: UpdateBusinessHoursDto): Promise<BusinessHours> {
    return this.repository.update(id, data);
  }

  /**
   * 新增特殊日期
   */
  async addSpecialDate(data: CreateSpecialDateDto): Promise<SpecialDate> {
    const businessHours = await this.repository.getOrCreate();
    return this.repository.addSpecialDate(businessHours.id, data);
  }

  /**
   * 刪除特殊日期
   */
  async deleteSpecialDate(id: string): Promise<void> {
    return this.repository.deleteSpecialDate(id);
  }

  /**
   * 獲取特定月份的特殊日期
   */
  async getSpecialDatesByMonth(year: number, month: number): Promise<SpecialDate[]> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    return this.repository.getSpecialDatesByRange(startDate, endDate);
  }

  /**
   * 檢查當前營業狀態
   */
  async checkBusinessStatus(now: Date = new Date()): Promise<BusinessStatus> {
    const businessHours = await this.repository.getOrCreate();

    // 使用台灣時區
    const taiwanTime = getTaiwanTime(now);
    const dayOfWeek = getTaiwanDayOfWeek(now);
    const timeInMinutes = getTaiwanTimeInMinutes(now);

    // 檢查是否為特殊日期（使用台灣時間）
    const specialDate = await this.repository.getSpecialDateByDate(taiwanTime);

    // 如果是特殊休假日
    if (specialDate && specialDate.type === DateType.CLOSED) {
      return {
        isOpen: false,
        orderWindow: 'CLOSED',
        message: `${specialDate.reason || '特殊休假日'}`,
        nextOpenTime: this.getNextOpenTime(taiwanTime, businessHours)
      };
    }

    // 如果是特殊營業日（覆蓋固定休息日）
    if (specialDate && specialDate.type === DateType.OPEN) {
      return this.checkOrderWindow(timeInMinutes, businessHours);
    }

    // 檢查是否為固定休息日
    if (businessHours.regularClosedDays.includes(dayOfWeek)) {
      return {
        isOpen: false,
        orderWindow: 'CLOSED',
        message: businessHours.closedDayMessage || '今日店休',
        nextOpenTime: this.getNextOpenTime(taiwanTime, businessHours)
      };
    }

    // 檢查訂單時段
    return this.checkOrderWindow(timeInMinutes, businessHours);
  }

  /**
   * 檢查訂單時段
   */
  private checkOrderWindow(timeInMinutes: number, businessHours: BusinessHours): BusinessStatus {
    const currentOrderStart = this.timeToMinutes(businessHours.currentOrderStartTime);
    const orderCutoff = this.timeToMinutes(businessHours.orderCutoffTime);
    const preorderStart = this.timeToMinutes(businessHours.preorderStartTime);

    // 當日訂單時段: 07:30 - 10:00
    if (timeInMinutes >= currentOrderStart && timeInMinutes < orderCutoff) {
      return {
        isOpen: true,
        orderWindow: 'CURRENT_DAY',
        message: businessHours.currentDayMessage || '當日訂單開放中，10:00 前下單今日配送'
      };
    }

    // 備貨時段: 10:00 - 14:00
    if (timeInMinutes >= orderCutoff && timeInMinutes < preorderStart) {
      return {
        isOpen: false,
        orderWindow: 'CLOSED',
        message: businessHours.preparationMessage || '準備中，下午 2:00 開放明日預訂'
      };
    }

    // 隔日預訂時段: 14:00 - 23:59
    if (timeInMinutes >= preorderStart) {
      return {
        isOpen: true,
        orderWindow: 'NEXT_DAY',
        message: businessHours.nextDayMessage || '明日配送預訂開放中'
      };
    }

    // 凌晨至開放前: 00:00 - 07:30
    return {
      isOpen: false,
      orderWindow: 'CLOSED',
      message: businessHours.beforeOpenMessage || `準備中，早上 ${businessHours.currentOrderStartTime} 開放當日訂單`
    };
  }

  /**
   * 驗證訂單時段
   */
  async validateOrderTiming(now: Date = new Date()): Promise<{ valid: boolean; message: string; orderWindow?: OrderWindow }> {
    const status = await this.checkBusinessStatus(now);

    if (!status.isOpen) {
      return {
        valid: false,
        message: status.message
      };
    }

    return {
      valid: true,
      message: status.message,
      orderWindow: status.orderWindow
    };
  }

  /**
   * 計算下次開放時間
   */
  private getNextOpenTime(now: Date, businessHours: BusinessHours): Date {
    const nextDay = new Date(now);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(parseInt(businessHours.currentOrderStartTime.split(':')[0]), parseInt(businessHours.currentOrderStartTime.split(':')[1]), 0, 0);

    // 如果下一天也是休息日，繼續往後找
    while (businessHours.regularClosedDays.includes(nextDay.getDay())) {
      nextDay.setDate(nextDay.getDate() + 1);
    }

    return nextDay;
  }

  /**
   * 將時間字串轉換為分鐘數
   */
  private timeToMinutes(timeString: string): number {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }
}
