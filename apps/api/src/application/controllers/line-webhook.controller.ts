import type { Request, Response } from 'express';
import * as crypto from 'crypto';
import { prisma } from '../../infrastructure/prisma/client';
import { logger } from '@chengyi/lib';

const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;

export class LineWebhookController {
  /**
   * 驗證 LINE Webhook 簽章
   */
  private verifySignature(body: string, signature: string): boolean {
    if (!LINE_CHANNEL_SECRET) {
      logger.warn('LINE_CHANNEL_SECRET not configured');
      return false;
    }

    const hash = crypto
      .createHmac('SHA256', LINE_CHANNEL_SECRET)
      .update(body)
      .digest('base64');

    return hash === signature;
  }

  /**
   * 處理 LINE Webhook 事件
   */
  webhook = async (req: Request, res: Response) => {
    try {
      const signature = req.headers['x-line-signature'] as string;
      const rawBody = (req as any).rawBody as string;

      // 驗證簽章
      if (!this.verifySignature(rawBody, signature)) {
        logger.warn('Invalid LINE webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }

      const { events } = req.body;

      // 處理每個事件
      for (const event of events ?? []) {
        await this.handleEvent(event);
      }

      res.json({ success: true });
    } catch (error) {
      logger.error({ error }, 'LINE webhook error');
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  /**
   * 處理單一事件
   */
  private async handleEvent(event: any) {
    try {
      if (event.type !== 'message' || event.message.type !== 'text') {
        return;
      }

      const { userId } = event.source;
      const messageText = event.message.text.trim();

      // 查詢 LINE 使用者
      const lineUser = await prisma.lineUser.findUnique({
        where: { lineUserId: userId }
      });

      if (!lineUser) {
        logger.debug({ userId }, 'LINE user not found in database');
        return;
      }

      // 解析客戶回應
      await this.parseCustomerResponse(lineUser.id, messageText);
    } catch (error) {
      logger.error({ error }, 'Error handling LINE event');
    }
  }

  /**
   * 解析客戶回應（接受/取消訂單）
   */
  private async parseCustomerResponse(lineUserId: string, messageText: string) {
    const text = messageText.toLowerCase().replace(/\s+/g, '');

    // 匹配「接受 {orderId}」或「取消 {orderId}」
    const acceptMatch = text.match(/^(接受|accept)([a-f0-9-]{8,})/i);
    const cancelMatch = text.match(/^(取消|cancel)([a-f0-9-]{8,})/i);

    if (acceptMatch) {
      const orderIdPrefix = acceptMatch[2];
      await this.handleAcceptOrder(lineUserId, orderIdPrefix);
    } else if (cancelMatch) {
      const orderIdPrefix = cancelMatch[2];
      await this.handleCancelOrder(lineUserId, orderIdPrefix);
    } else {
      logger.debug({ messageText }, 'Unrecognized customer response format');
    }
  }

  /**
   * 處理客戶接受價格變動
   */
  private async handleAcceptOrder(lineUserId: string, orderIdPrefix: string) {
    try {
      // 查詢 LINE 使用者的手機號碼
      const lineUser = await prisma.lineUser.findUnique({
        where: { id: lineUserId }
      });

      if (!lineUser?.phone) {
        logger.warn({ lineUserId }, 'LINE user has no phone number');
        return;
      }

      // 查詢訂單（匹配 ID 前綴）
      const orders = await prisma.order.findMany({
        where: {
          contactPhone: lineUser.phone,
          priceAlertSent: true,
          priceConfirmed: null,
          id: {
            startsWith: orderIdPrefix
          }
        }
      });

      if (orders.length === 0) {
        logger.debug({ orderIdPrefix }, 'No matching order found');
        return;
      }

      const order = orders[0];

      // 更新訂單狀態為已確認
      await prisma.order.update({
        where: { id: order.id },
        data: {
          priceConfirmed: true
        }
      });

      // 更新價格通知記錄
      await prisma.priceChangeAlert.updateMany({
        where: { orderId: order.id },
        data: {
          confirmedAt: new Date(),
          customerResponse: 'accepted'
        }
      });

      logger.info({ orderId: order.id }, 'Customer accepted price change');
    } catch (error) {
      logger.error({ error }, 'Error handling accept order');
    }
  }

  /**
   * 處理客戶取消訂單
   */
  private async handleCancelOrder(lineUserId: string, orderIdPrefix: string) {
    try {
      const lineUser = await prisma.lineUser.findUnique({
        where: { id: lineUserId }
      });

      if (!lineUser?.phone) {
        logger.warn({ lineUserId }, 'LINE user has no phone number');
        return;
      }

      const orders = await prisma.order.findMany({
        where: {
          contactPhone: lineUser.phone,
          priceAlertSent: true,
          priceConfirmed: null,
          id: {
            startsWith: orderIdPrefix
          }
        }
      });

      if (orders.length === 0) {
        logger.debug({ orderIdPrefix }, 'No matching order found');
        return;
      }

      const order = orders[0];

      // 更新訂單狀態為已取消
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'cancelled',
          priceConfirmed: false
        }
      });

      // 更新價格通知記錄
      await prisma.priceChangeAlert.updateMany({
        where: { orderId: order.id },
        data: {
          confirmedAt: new Date(),
          customerResponse: 'cancelled'
        }
      });

      logger.info({ orderId: order.id }, 'Customer cancelled order due to price change');
    } catch (error) {
      logger.error({ error }, 'Error handling cancel order');
    }
  }
}
