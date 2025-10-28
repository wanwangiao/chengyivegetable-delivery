import { PrismaClient, BusinessHours, SpecialDate, DateType } from '@prisma/client';

export interface CreateSpecialDateDto {
  date: Date;
  type: DateType;
  reason?: string;
}

export interface UpdateBusinessHoursDto {
  regularClosedDays?: number[];
  orderCutoffTime?: string;
  preorderStartTime?: string;
  currentOrderStartTime?: string;
  // 自訂狀態訊息
  currentDayMessage?: string;
  nextDayMessage?: string;
  preparationMessage?: string;
  beforeOpenMessage?: string;
  closedDayMessage?: string;
}

export class BusinessHoursRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * 獲取營業時間設定（如果不存在則創建默認設定）
   */
  async getOrCreate(): Promise<BusinessHours> {
    let businessHours = await this.prisma.businessHours.findFirst({
      include: {
        specialDates: {
          orderBy: {
            date: 'asc'
          }
        }
      }
    });

    if (!businessHours) {
      // 創建默認設定
      businessHours = await this.prisma.businessHours.create({
        data: {
          regularClosedDays: [1, 4], // Monday (1), Thursday (4)
          orderCutoffTime: '10:00',
          preorderStartTime: '14:00',
          currentOrderStartTime: '07:30'
        },
        include: {
          specialDates: true
        }
      });
    }

    return businessHours;
  }

  /**
   * 更新營業時間設定
   */
  async update(id: string, data: UpdateBusinessHoursDto): Promise<BusinessHours> {
    return this.prisma.businessHours.update({
      where: { id },
      data,
      include: {
        specialDates: {
          orderBy: {
            date: 'asc'
          }
        }
      }
    });
  }

  /**
   * 新增特殊日期
   */
  async addSpecialDate(businessHoursId: string, data: CreateSpecialDateDto): Promise<SpecialDate> {
    return this.prisma.specialDate.create({
      data: {
        ...data,
        businessHoursId
      }
    });
  }

  /**
   * 刪除特殊日期
   */
  async deleteSpecialDate(id: string): Promise<void> {
    await this.prisma.specialDate.delete({
      where: { id }
    });
  }

  /**
   * 獲取特定日期範圍的特殊日期
   */
  async getSpecialDatesByRange(startDate: Date, endDate: Date): Promise<SpecialDate[]> {
    return this.prisma.specialDate.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: {
        date: 'asc'
      }
    });
  }

  /**
   * 獲取特定日期的特殊日期設定
   */
  async getSpecialDateByDate(date: Date): Promise<SpecialDate | null> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.prisma.specialDate.findFirst({
      where: {
        date: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    });
  }
}
