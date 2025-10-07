import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { extname } from 'node:path';
import type { Express } from 'express';
import { storageConfig } from '../../config/storage';

const ensureDirectory = async () => {
  await fs.mkdir(storageConfig.root, { recursive: true });
};

const normaliseExtension = (filename: string) => {
  const ext = extname(filename).toLowerCase();
  return ext || '.jpg';
};

export interface SavedProductImage {
  imageUrl: string;
  imageKey: string;
}

export const saveProductImage = async (file: Express.Multer.File): Promise<SavedProductImage> => {
  await ensureDirectory();

  const extension = normaliseExtension(file.originalname ?? '');
  const imageKey = `${randomUUID()}${extension}`;
  const destination = storageConfig.resolve(imageKey);

  await fs.writeFile(destination, file.buffer);

  return {
    imageKey,
    imageUrl: `/uploads/${imageKey}`
  };
};

export const removeProductImage = async (imageKey: string): Promise<void> => {
  const target = storageConfig.resolve(imageKey);

  try {
    await fs.unlink(target);
  } catch (error: any) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }
};
