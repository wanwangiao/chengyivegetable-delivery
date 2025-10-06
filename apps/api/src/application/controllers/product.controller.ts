import type { Request, Response } from 'express';
import { ProductService } from '../../domain/product-service';

export class ProductController {
  constructor(private readonly productService: ProductService) {}

  list = async (req: Request, res: Response) => {
    const { keyword, category, onlyAvailable } = req.query;

    const products = await this.productService.list({
      keyword: typeof keyword === 'string' ? keyword : undefined,
      category: typeof category === 'string' ? category : undefined,
      onlyAvailable: typeof onlyAvailable === 'string' ? onlyAvailable === 'true' : undefined
    });

    res.json({ data: products });
  };

  create = async (req: Request, res: Response) => {
    const product = await this.productService.create(req.body);
    res.status(201).json({ data: product });
  };

  update = async (req: Request, res: Response) => {
    const product = await this.productService.update(req.params.id, req.body);
    res.json({ data: product });
  };

  toggle = async (req: Request, res: Response) => {
    const product = await this.productService.toggleAvailability(req.params.id, Boolean(req.body?.isAvailable));
    res.json({ data: product });
  };
}
