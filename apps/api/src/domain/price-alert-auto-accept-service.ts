import { prisma } from '../infrastructure/prisma/client';
import { logger } from '@chengyi/lib';

export class PriceAlertAutoAcceptService {
  /**
   * 檢查並自動接受超時的價格變動通知
   */
  async processTimeoutAlerts(): Promise<{ processed: number; accepted: number }> {
    try {
      // 取得系統設定的超時時間（分鐘）
      const config = await prisma.systemConfig.findUnique({
        where: { id: 'system-config' }
      });

      const timeoutMinutes = config?.priceConfirmTimeout ?? 30;
      const timeoutDate = new Date();
      timeoutDate.setMinutes(timeoutDate.getMinutes() - timeoutMinutes);

      // 查詢所有超時且未回應的價格通知
      const timeoutAlerts = await prisma.priceChangeAlert.findMany({
        where: {
          sentAt: {
            lte: timeoutDate
          },
          confirmedAt: null,
          autoAcceptedAt: null
        },
        include: {
          order: true
        }
      });

      let acceptedCount = 0;

      for (const alert of timeoutAlerts) {
        try {
          // 檢查訂單是否仍待確認
          if (alert.order.priceConfirmed !== null) {
            continue;
          }

          // 自動接受價格變動
          await prisma.$transaction([
            prisma.order.update({
              where: { id: alert.orderId },
              data: { priceConfirmed: true }
            }),
            prisma.priceChangeAlert.update({
              where: { id: alert.id },
              data: {
                autoAcceptedAt: new Date(),
                customerResponse: 'auto-accepted'
              }
            })
          ]);

          acceptedCount++;
          logger.info(
            { orderId: alert.orderId, alertId: alert.id },
            'Price change auto-accepted due to timeout'
          );
        } catch (error) {
          logger.error(
            { error, alertId: alert.id },
            'Error auto-accepting price change alert'
          );
        }
      }

      return {
        processed: timeoutAlerts.length,
        accepted: acceptedCount
      };
    } catch (error) {
      logger.error({ error }, 'Error processing timeout alerts');
      throw error;
    }
  }

  /**
   * 啟動定期檢查（每 5 分鐘執行一次）
   */
  startPeriodicCheck(): NodeJS.Timeout {
    logger.info('Starting price alert auto-accept periodic check (every 5 minutes)');

    return setInterval(async () => {
      try {
        const result = await this.processTimeoutAlerts();
        if (result.accepted > 0) {
          logger.info(
            { processed: result.processed, accepted: result.accepted },
            'Auto-accept check completed'
          );
        }
      } catch (error) {
        logger.error({ error }, 'Error in periodic auto-accept check');
      }
    }, 5 * 60 * 1000); // 5 分鐘
  }
}
