import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { extname, join } from 'node:path';
import type { Express } from 'express';
import { storageConfig } from '../../config/storage';

const deliveryProofsDir = storageConfig.resolve('delivery-proofs');

const ensureDirectory = async () => {
  await fs.mkdir(deliveryProofsDir, { recursive: true });
};

const normaliseExtension = (filename: string) => {
  const ext = extname(filename ?? '').toLowerCase();
  return ext || '.jpg';
};

export interface SavedDeliveryProof {
  imageKey: string;
  imageUrl: string;
}

export const saveDeliveryProofImage = async (file: Express.Multer.File): Promise<SavedDeliveryProof> => {
  await ensureDirectory();

  const extension = normaliseExtension(file.originalname ?? '');
  const imageKey = `${randomUUID()}${extension}`;
  const relativePath = join('delivery-proofs', imageKey);
  const destination = storageConfig.resolve(relativePath);

  await fs.writeFile(destination, file.buffer);

  return {
    imageKey,
    imageUrl: `/uploads/delivery-proofs/${imageKey}`
  };
};
