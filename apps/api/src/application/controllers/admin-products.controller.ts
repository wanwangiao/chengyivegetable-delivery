import type { Request, Response } from 'express';
import { ProductService } from '../../domain/product-service';
import { removeProductImage, saveProductImage } from '../../infrastructure/storage/product-image.storage';

export class AdminProductsController {
  constructor(private readonly productService: ProductService) {}

  list = async (_req: Request, res: Response) => {
    const { products, stats } = await this.productService.listWithStats();
    res.json({ data: products, stats });
  };

  update = async (req: Request, res: Response) => {
    const { id } = req.params;
    const product = await this.productService.update(id, req.body);
    res.json({ data: product });
  };

  toggle = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { isAvailable } = req.body ?? {};
    const product = await this.productService.toggleAvailability(id, Boolean(isAvailable));
    res.json({ data: product });
  };

  uploadImage = async (req: Request, res: Response) => {
    const { id } = req.params;
    const file = req.file as Express.Multer.File | undefined;

    if (!file) {
      return res.status(400).json({ error: 'IMAGE_REQUIRED', message: '請選擇商品圖片後再上傳' });
    }

    const existing = await this.productService.findById(id);
    if (!existing) {
      return res.status(404).json({ error: 'PRODUCT_NOT_FOUND' });
    }

    const saved = await saveProductImage(file);

    if (existing.imageKey) {
      await removeProductImage(existing.imageKey);
    }

    const product = await this.productService.updateImage(id, saved);

    res.json({ data: product });
  };

  importCsv = async (req: Request, res: Response) => {
    const file = req.file as Express.Multer.File | undefined;

    if (!file?.buffer) {
      return res.status(400).json({ error: 'FILE_REQUIRED', message: '請選擇要匯入的 CSV 檔案' });
    }

    const products = await this.productService.importProductsCsv(file.buffer);

    res.json({ data: products, imported: products.length });
  };

  exportCsv = async (_req: Request, res: Response) => {
    const csv = await this.productService.exportProductsCsv();

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="products-${new Date().toISOString()}.csv"`);
    res.send(csv);
  };

  bulkUpsert = async (req: Request, res: Response) => {
    const items = Array.isArray(req.body?.products) ? req.body.products : [];
    const products = await this.productService.bulkUpsert(items);
    res.json({ data: products, count: products.length });
  };

  reorder = async (req: Request, res: Response) => {
    const items = Array.isArray(req.body?.items)
      ? req.body.items
      : Array.isArray(req.body)
        ? req.body
        : [];

    if (items.length === 0) {
      return res.status(400).json({ error: 'EMPTY_SORT_PAYLOAD', message: '請提供要更新的排序資料' });
    }

    const products = await this.productService.reorder(items);
    res.json({ data: products, count: products.length });
  };
}
