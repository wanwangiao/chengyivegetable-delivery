import type { RequestHandler } from 'express';
import multer from 'multer';

const storage = multer.memoryStorage();

const imageUploader = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (_req, file, callback) => {
    if (!file.mimetype.startsWith('image/')) {
      callback(new Error('INVALID_IMAGE_TYPE'));
      return;
    }
    callback(null, true);
  }
});

const csvUploader = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024
  },
  fileFilter: (_req, file, callback) => {
    const accepted = file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv');
    if (!accepted) {
      callback(new Error('INVALID_CSV_FILE'));
      return;
    }
    callback(null, true);
  }
});

export const productImageUpload: RequestHandler = imageUploader.single('image');
export const deliveryProofUpload: RequestHandler = imageUploader.single('proof');
export const csvUpload: RequestHandler = csvUploader.single('file');
