import { Request, Response } from 'express';
import { BusinessHoursService } from '../../domain/business-hours.service';
import { DateType } from '@prisma/client';

export class BusinessHoursController {
  constructor(private readonly service: BusinessHoursService) {}

  /**
   * 獲取營業時間設定
   * GET /api/v1/business-hours
   */
  getSettings = async (req: Request, res: Response): Promise<void> => {
    const businessHours = await this.service.getBusinessHours();

    res.json({
      success: true,
      data: businessHours
    });
  };

  /**
   * 更新營業時間設定
   * PATCH /api/v1/business-hours/:id
   */
  updateSettings = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { regularClosedDays, orderCutoffTime, preorderStartTime, currentOrderStartTime } = req.body;

    const businessHours = await this.service.updateBusinessHours(id, {
      regularClosedDays,
      orderCutoffTime,
      preorderStartTime,
      currentOrderStartTime
    });

    res.json({
      success: true,
      data: businessHours,
      message: '營業時間設定已更新'
    });
  };

  /**
   * 新增特殊日期
   * POST /api/v1/business-hours/special-dates
   */
  addSpecialDate = async (req: Request, res: Response): Promise<void> => {
    const { date, type, reason } = req.body;

    if (!date || !type) {
      res.status(400).json({
        success: false,
        message: '日期和類型為必填欄位'
      });
      return;
    }

    if (!Object.values(DateType).includes(type)) {
      res.status(400).json({
        success: false,
        message: '無效的日期類型'
      });
      return;
    }

    const specialDate = await this.service.addSpecialDate({
      date: new Date(date),
      type: type as DateType,
      reason
    });

    res.status(201).json({
      success: true,
      data: specialDate,
      message: '特殊日期已新增'
    });
  };

  /**
   * 刪除特殊日期
   * DELETE /api/v1/business-hours/special-dates/:id
   */
  deleteSpecialDate = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    await this.service.deleteSpecialDate(id);

    res.json({
      success: true,
      message: '特殊日期已刪除'
    });
  };

  /**
   * 獲取特定月份的特殊日期
   * GET /api/v1/business-hours/special-dates?year=2024&month=10
   */
  getSpecialDatesByMonth = async (req: Request, res: Response): Promise<void> => {
    const { year, month } = req.query;

    if (!year || !month) {
      res.status(400).json({
        success: false,
        message: '年份和月份為必填參數'
      });
      return;
    }

    const specialDates = await this.service.getSpecialDatesByMonth(
      parseInt(year as string),
      parseInt(month as string)
    );

    res.json({
      success: true,
      data: specialDates
    });
  };

  /**
   * 檢查當前營業狀態
   * GET /api/v1/business-hours/status
   */
  checkStatus = async (req: Request, res: Response): Promise<void> => {
    const status = await this.service.checkBusinessStatus();

    res.json({
      success: true,
      data: status
    });
  };

  /**
   * 驗證訂單時段
   * GET /api/v1/business-hours/validate
   */
  validateOrderTiming = async (req: Request, res: Response): Promise<void> => {
    const validation = await this.service.validateOrderTiming();

    res.json({
      success: validation.valid,
      data: validation
    });
  };
}
