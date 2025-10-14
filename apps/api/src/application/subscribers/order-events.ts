import { eventBus, logger } from '@chengyi/lib';
import { prisma } from '../../infrastructure/prisma/client';

// 檢查 LINE Channel Access Token 是否設定
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

if (!LINE_CHANNEL_ACCESS_TOKEN) {
  logger.warn('LINE_CHANNEL_ACCESS_TOKEN not configured. LINE notifications will be disabled.');
}

/**
 * 發送 LINE 推播訊息
 */
async function sendLineMessage(lineUserId: string, message: string): Promise<boolean> {
  if (!LINE_CHANNEL_ACCESS_TOKEN) {
    logger.debug('LINE notification skipped: token not configured');
    return false;
  }

  try {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [{
          type: 'text',
          text: message.substring(0, 2000) // LINE 限制 2000 字元
        }]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({ error }, 'LINE message push failed');
      return false;
    }

    logger.info({ lineUserId }, 'LINE message sent successfully');
    return true;
  } catch (error) {
    logger.error({ error }, 'Failed to send LINE message');
    return false;
  }
}

/**
 * 根據電話號碼查詢 LINE 使用者
 */
async function findLineUserByPhone(phone: string) {
  return await prisma.lineUser.findFirst({
    where: { phone }
  });
}

// ========== 事件監聽器 ==========

/**
 * 1. 新訂單建立通知
 */
eventBus.on('order.created', async (data: any) => {
  try {
    const { orderId, phone, contactName, totalAmount, deliveryDate, isPreOrder } = data;

    const lineUser = await findLineUserByPhone(phone);
    if (!lineUser) {
      logger.debug({ phone }, 'No LINE user found for phone number');
      return;
    }

    const dateStr = new Date(deliveryDate).toLocaleDateString('zh-TW');
    const orderTypeText = isPreOrder ? '預訂單' : '當日訂單';

    const message = `【訂單確認通知】

${contactName} 您好！

您的${orderTypeText}已成功建立：
訂單編號：${orderId.substring(0, 8)}
配送日期：${dateStr}
訂單金額：NT$ ${totalAmount}

我們會盡快為您處理，謝謝！

如有問題請聯繫客服。`;

    await sendLineMessage(lineUser.lineUserId, message);
  } catch (error) {
    logger.error({ error }, 'Error handling order.created event');
  }
});

/**
 * 2. 訂單狀態變更通知
 */
eventBus.on('order.status-changed', async (data: any) => {
  try {
    const { orderId, phone, status, note, driverId } = data;

    const lineUser = await findLineUserByPhone(phone);
    if (!lineUser) {
      logger.debug({ phone }, 'No LINE user found for phone number');
      return;
    }

    const statusMap: Record<string, string> = {
      pending: '待處理',
      preparing: '準備中',
      ready: '包裝完成',
      delivering: '配送中',
      delivered: '已送達',
      cancelled: '已取消'
    };

    const statusText = statusMap[status] ?? status;
    let message = `【訂單狀態更新】

您的訂單（編號：${orderId.substring(0, 8)}）狀態已更新：

目前狀態：${statusText}`;

    if (note) {
      message += `\n備註：${note}`;
    }

    if (driverId) {
      logger.info({ orderId, driverId }, 'Driver assigned to order');
      message += '\n\n已指派配送員為您服務。';
    }

    await sendLineMessage(lineUser.lineUserId, message);
  } catch (error) {
    logger.error({ error }, 'Error handling order.status-changed event');
  }
});

/**
 * 3. 價格變動通知（新增）
 */
eventBus.on('order.price-alert', async (data: any) => {
  try {
    const { orderId, phone, contactName, deliveryDate, priceChanges, oldTotal, newTotal, totalDiffPercent } = data;

    const lineUser = await findLineUserByPhone(phone);
    if (!lineUser) {
      logger.debug({ phone }, 'No LINE user found for phone number');
      return;
    }

    const dateStr = new Date(deliveryDate).toLocaleDateString('zh-TW');
    const trend = newTotal > oldTotal ? '上漲' : '下降';

    let message = `【價格變動通知】

${contactName} 您好！

您的預訂單（配送日期：${dateStr}）中有商品價格調整：

`;

    // 逐項列出價格變動
    for (const change of priceChanges.slice(0, 5)) { // 最多顯示 5 項
      const changeSymbol = change.diffPercent > 0 ? '↑' : '↓';
      message += `${change.productName}\n`;
      message += `  數量：${change.quantity} ${change.unit}\n`;
      message += `  原價：$${change.oldPrice}\n`;
      message += `  新價：$${change.newPrice}\n`;
      message += `  變動：${changeSymbol} ${Math.abs(change.diffPercent).toFixed(1)}%\n\n`;
    }

    if (priceChanges.length > 5) {
      message += `... 還有 ${priceChanges.length - 5} 項商品\n\n`;
    }

    message += `訂單總金額：$${oldTotal} → $${newTotal}\n`;
    message += `變動幅度：${trend} ${Math.abs(totalDiffPercent).toFixed(1)}%\n\n`;
    message += `請於 30 分鐘內回覆：\n`;
    message += `▶ 回覆「接受 ${orderId.substring(0, 8)}」接受新價格\n`;
    message += `▶ 回覆「取消 ${orderId.substring(0, 8)}」取消訂單\n\n`;
    message += `※ 30分鐘內未回應視為接受新價格`;

    const sent = await sendLineMessage(lineUser.lineUserId, message);

    if (sent) {
      // 記錄價格變動通知
      await prisma.priceChangeAlert.create({
        data: {
          orderId,
          priceChanges: priceChanges as any,
          sentAt: new Date()
        }
      });

      // 更新訂單狀態
      await prisma.order.update({
        where: { id: orderId },
        data: {
          priceAlertSent: true,
          priceAlertSentAt: new Date()
        }
      });

      logger.info({ orderId, phone }, 'Price change alert sent successfully');
    }
  } catch (error) {
    logger.error({ error }, 'Error handling order.price-alert event');
  }
});

logger.info('Order event subscribers initialized');
