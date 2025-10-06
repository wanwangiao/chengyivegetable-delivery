import { prisma } from './client';

const CONFIG_ID = 'delivery-config';

export interface DeliveryConfigRecord {
  id: string;
  pickupName: string;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  recommendedBatchMin: number;
  recommendedBatchMax: number;
  autoBatchingEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const mapConfig = (record: any): DeliveryConfigRecord => ({
  id: record.id,
  pickupName: record.pickupName,
  pickupAddress: record.pickupAddress,
  pickupLat: Number(record.pickupLat ?? 0),
  pickupLng: Number(record.pickupLng ?? 0),
  recommendedBatchMin: Number(record.recommendedBatchMin ?? 5),
  recommendedBatchMax: Number(record.recommendedBatchMax ?? 8),
  autoBatchingEnabled: record.autoBatchingEnabled ?? true,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt
});

export const DEFAULT_DELIVERY_CONFIG: DeliveryConfigRecord = {
  id: CONFIG_ID,
  pickupName: '未設定取貨點',
  pickupAddress: '',
  pickupLat: 0,
  pickupLng: 0,
  recommendedBatchMin: 5,
  recommendedBatchMax: 8,
  autoBatchingEnabled: true,
  createdAt: new Date(0),
  updatedAt: new Date(0)
};

export interface DeliveryConfigRepository {
  getConfig(): Promise<DeliveryConfigRecord>;
  saveConfig(
    input: Omit<DeliveryConfigRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<DeliveryConfigRecord>;
}

export const prismaDeliveryRepository: DeliveryConfigRepository = {
  async getConfig() {
    const record = await prisma.deliveryConfig.findUnique({
      where: { id: CONFIG_ID }
    });

    if (!record) {
      return DEFAULT_DELIVERY_CONFIG;
    }

    return mapConfig(record);
  },

  async saveConfig(input) {
    const record = await prisma.deliveryConfig.upsert({
      where: { id: CONFIG_ID },
      update: {
        pickupName: input.pickupName,
        pickupAddress: input.pickupAddress,
        pickupLat: input.pickupLat,
        pickupLng: input.pickupLng,
        recommendedBatchMin: input.recommendedBatchMin,
        recommendedBatchMax: input.recommendedBatchMax,
        autoBatchingEnabled: input.autoBatchingEnabled
      },
      create: {
        id: CONFIG_ID,
        pickupName: input.pickupName,
        pickupAddress: input.pickupAddress,
        pickupLat: input.pickupLat,
        pickupLng: input.pickupLng,
        recommendedBatchMin: input.recommendedBatchMin,
        recommendedBatchMax: input.recommendedBatchMax,
        autoBatchingEnabled: input.autoBatchingEnabled
      }
    });

    return mapConfig(record);
  }
};
