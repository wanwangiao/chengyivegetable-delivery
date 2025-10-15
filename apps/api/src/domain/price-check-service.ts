import type { OrderRepository } from '../infrastructure/prisma/order.repository';
import type { ProductRepository } from '../infrastructure/prisma/product.repository';
import { eventBus } from '@chengyi/lib';

export interface PriceChange {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  oldPrice: number;
  newPrice: number;
  priceDiff: number;
  diffPercent: number;
}

export interface PriceChangeReport {
  orderId: string;
  contactName: string;
  contactPhone: string;
  deliveryDate: Date;
  priceChanges: PriceChange[];
  oldTotal: number;
  newTotal: number;
  totalDiffPercent: number;
}

export class PriceCheckService {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly productRepository: ProductRepository
  ) {}

  async checkTodayPreOrders(threshold: number): Promise<PriceChangeReport[]> {
    // 取得今日的所有預訂單（尚未發送價格通知的）
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 取得所有訂單
    const allOrders = await this.orderRepository.list();

    // 篩選今日配送的預訂單且尚未發送價格通知
    const preOrders = allOrders.filter(order => {
      const deliveryDate = new Date(order.deliveryDate || '');
      deliveryDate.setHours(0, 0, 0, 0);

      return (
        order.isPreOrder === true &&
        deliveryDate.getTime() === today.getTime() &&
        order.priceAlertSent === false
      );
    });

    // 取得所有商品資訊
    const products = await this.productRepository.list();
    const productMap = new Map(products.map(p => [p.id, p]));

    const reports: PriceChangeReport[] = [];

    for (const order of preOrders) {
      const priceChanges: PriceChange[] = [];
      let oldTotal = 0;
      let newTotal = 0;

      for (const item of order.items) {
        const product = productMap.get(item.productId);
        if (!product) continue;

        const oldPrice = item.unitPrice;

        // 根據商品類型決定使用哪個價格
        let newPrice: number;
        if (product.isPricedItem) {
          // 秤重商品使用 nextDayWeightPricePerUnit 或 weightPricePerUnit
          newPrice = product.nextDayWeightPricePerUnit ?? product.weightPricePerUnit ?? oldPrice;
        } else {
          // 固定價商品使用 nextDayPrice 或 price
          newPrice = product.nextDayPrice ?? product.price ?? oldPrice;
        }

        const itemOldTotal = oldPrice * item.quantity;
        const itemNewTotal = newPrice * item.quantity;

        oldTotal += itemOldTotal;
        newTotal += itemNewTotal;

        // 計算價格差異
        const priceDiff = newPrice - oldPrice;
        const diffPercent = oldPrice !== 0 ? Math.abs((priceDiff / oldPrice) * 100) : 0;

        // 如果差異超過閾值，加入報告
        if (diffPercent >= threshold) {
          priceChanges.push({
            productId: item.productId,
            productName: item.name,
            quantity: item.quantity,
            unit: item.unit,
            oldPrice,
            newPrice,
            priceDiff,
            diffPercent
          });
        }
      }

      // 如果有價格變動，加入報告
      if (priceChanges.length > 0) {
        const totalDiffPercent = oldTotal !== 0 ? Math.abs(((newTotal - oldTotal) / oldTotal) * 100) : 0;

        reports.push({
          orderId: order.id,
          contactName: order.contactName,
          contactPhone: order.contactPhone,
          deliveryDate: new Date(order.deliveryDate || ''),
          priceChanges,
          oldTotal,
          newTotal,
          totalDiffPercent
        });
      }
    }

    // 觸發價格變動通知事件
    for (const report of reports) {
      if (report.priceChanges.length > 0) {
        eventBus.emit('order.price-alert', {
          orderId: report.orderId,
          phone: report.contactPhone,
          contactName: report.contactName,
          deliveryDate: report.deliveryDate,
          priceChanges: report.priceChanges,
          oldTotal: report.oldTotal,
          newTotal: report.newTotal,
          totalDiffPercent: report.totalDiffPercent
        });
      }
    }

    return reports;
  }
}
