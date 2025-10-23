import type { Express } from 'express';
import { cloudinary } from '../../config/cloudinary';
import { env } from '../../config/env';

export interface SavedProductImage {
  imageUrl: string;
  imageKey: string;
  mimeType?: string;
}

/**
 * 上傳商品圖片到 Cloudinary
 * - 自動優化為 WebP 格式
 * - 保持原始比例，最大邊 1200px
 * - 儲存在 products 資料夾
 */
export const uploadToCloudinary = async (file: Express.Multer.File): Promise<SavedProductImage> => {
  return new Promise((resolve, reject) => {
    // 使用 upload_stream 從記憶體上傳
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'products', // Cloudinary 資料夾
        format: 'webp',     // 自動轉換為 WebP
        transformation: [
          {
            width: 1200,
            height: 1200,
            crop: 'limit',    // 限制最大尺寸，但不裁切，保持原始比例
            quality: 'auto:best' // 自動優化品質（提升為 best）
          }
        ],
        resource_type: 'image'
      },
      (error, result) => {
        if (error) {
          const uploadError = new Error('CLOUDINARY_UPLOAD_FAILED');
          (uploadError as Error & { cause?: unknown }).cause = error;
          reject(uploadError);
          return;
        }

        if (!result) {
          reject(new Error('CLOUDINARY_NO_RESULT'));
          return;
        }

        resolve({
          imageUrl: result.secure_url,  // HTTPS URL
          imageKey: result.public_id,   // Cloudinary public_id
          mimeType: 'image/webp'
        });
      }
    );

    // 將檔案 buffer 寫入 upload stream
    uploadStream.end(file.buffer);
  });
};

/**
 * 從 Cloudinary 刪除圖片
 */
export const removeFromCloudinary = async (imageKey: string): Promise<void> => {
  try {
    await cloudinary.uploader.destroy(imageKey);
  } catch (error: any) {
    // 如果圖片不存在，不拋出錯誤
    if (error?.http_code !== 404) {
      throw error;
    }
  }
};

/**
 * 檢查是否啟用 Cloudinary
 */
export const isCloudinaryEnabled = (): boolean => {
  return !!(
    env.CLOUDINARY_CLOUD_NAME &&
    env.CLOUDINARY_API_KEY &&
    env.CLOUDINARY_API_SECRET
  );
};
