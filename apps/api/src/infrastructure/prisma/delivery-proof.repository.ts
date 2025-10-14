import { prisma } from './client';

export interface DeliveryProofRecord {
  id: string;
  orderId: string;
  driverId: string;
  imageKey: string;
  createdAt: Date;
}

export interface DeliveryProofRepository {
  create(input: { orderId: string; driverId: string; imageKey: string }): Promise<DeliveryProofRecord>;
  listByOrder(orderId: string): Promise<DeliveryProofRecord[]>;
}

const mapRecord = (record: any): DeliveryProofRecord => ({
  id: record.id,
  orderId: record.orderId,
  driverId: record.driverId,
  imageKey: record.imageKey,
  createdAt: record.createdAt
});

export const prismaDeliveryProofRepository: DeliveryProofRepository = {
  async create(input) {
    const record = await prisma.deliveryProof.create({
      data: {
        orderId: input.orderId,
        driverId: input.driverId,
        imageKey: input.imageKey
      }
    });

    return mapRecord(record);
  },

  async listByOrder(orderId) {
    const records = await prisma.deliveryProof.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' }
    });

    return records.map(mapRecord);
  }
};
