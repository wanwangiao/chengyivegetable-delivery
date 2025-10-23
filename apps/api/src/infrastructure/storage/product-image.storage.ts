import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import type { Express } from 'express';
import sharp from 'sharp';
import { storageConfig } from '../../config/storage';
import {
  uploadToCloudinary,
  removeFromCloudinary,
  isCloudinaryEnabled
} from './cloudinary-product-image.storage';

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

/**
 * 儲存商品圖片 - 自動選擇 Cloudinary 或本地儲存
 */
export const saveProductImage = async (file: Express.Multer.File): Promise<SavedProductImage> => {
  // 如果啟用 Cloudinary，直接上傳到雲端
  if (isCloudinaryEnabled()) {
    console.log('📤 Uploading image to Cloudinary...');
    return await uploadToCloudinary(file);
  }

  // 否則使用本地儲存（原邏輯）
  console.log('💾 Saving image to local storage...');
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

/**
 * 刪除商品圖片 - 自動選擇 Cloudinary 或本地儲存
 */
export const removeProductImage = async (imageKey: string): Promise<void> => {
  // 如果 imageKey 包含斜線，判斷為 Cloudinary public_id
  if (imageKey.includes('/')) {
    console.log('🗑️  Removing image from Cloudinary...');
    return await removeFromCloudinary(imageKey);
  }

  // 否則從本地刪除
  console.log('🗑️  Removing image from local storage...');
  const target = storageConfig.resolve(imageKey);

  try {
    await fs.unlink(target);
  } catch (error: any) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }
};
