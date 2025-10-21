import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import type { Express } from 'express';
import sharp from 'sharp';
import { storageConfig } from '../../config/storage';

const ensureDirectory = async () => {
  await fs.mkdir(storageConfig.root, { recursive: true });
};

export interface SavedProductImage {
  imageUrl: string;
  imageKey: string;
  mimeType?: string;
}

const TARGET_SIZE = 800;
const OUTPUT_EXTENSION = '.webp';
const OUTPUT_MIME = 'image/webp';

const processImage = async (buffer: Buffer) => {
  return await sharp(buffer)
    .rotate()
    .resize(TARGET_SIZE, TARGET_SIZE, { fit: 'cover', position: 'centre' })
    .webp({
      quality: 80,
      effort: 5
    })
    .toBuffer();
};

export const saveProductImage = async (file: Express.Multer.File): Promise<SavedProductImage> => {
  await ensureDirectory();

  let processed: Buffer;
  try {
    processed = await processImage(file.buffer);
  } catch (error) {
    const processingError = new Error('IMAGE_PROCESSING_FAILED');
    (processingError as Error & { cause?: unknown }).cause = error;
    throw processingError;
  }

  const imageKey = `${randomUUID()}${OUTPUT_EXTENSION}`;
  const destination = storageConfig.resolve(imageKey);

  await fs.writeFile(destination, processed);

  return {
    imageKey,
    imageUrl: `/uploads/${imageKey}`,
    mimeType: OUTPUT_MIME
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
