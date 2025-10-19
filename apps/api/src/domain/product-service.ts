import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { z } from 'zod';
import type { ProductRepository, ProductBulkUpsertInput, ProductOptionInput } from '../infrastructure/prisma/product.repository';
import type { OrderRepository } from '../infrastructure/prisma/order.repository';
import { PriceCheckService, type PriceChangeReport } from './price-check-service';

const optionSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, '商品選項名稱不可為空'),
  price: z.number().nonnegative('商品選項價格需為非負數').nullable().optional()
});

const baseProductSchema = z.object({
  name: z.string().min(1, '商品名稱不可為空'),
  description: z.string().optional(),
  category: z.string().min(1, '商品分類不可為空'),
  unit: z.string().min(1, '商品單位不可為空'),
  unitHint: z.string().optional(),
  price: z.number().nonnegative('價格需為非負數').nullable().optional(),
  nextDayPrice: z.number().nonnegative('隔天預估價需為非負數').nullable().optional(),
  stock: z.number().nonnegative('庫存需為非負數').default(0),
  isAvailable: z.boolean().default(true),
  isPricedItem: z.boolean().default(false),
  weightPricePerUnit: z.number().nonnegative('秤重商品應有單位價格').nullable().optional(),
  nextDayWeightPricePerUnit: z.number().nonnegative('隔天秤重預估價需為非負數').nullable().optional(),
  sortOrder: z.number().int().optional(),
  imageUrl: z.string().min(1).optional(),
  imageKey: z.string().optional(),
  options: z.array(optionSchema).default([])
});

const withProductRules = <T extends z.ZodTypeAny>(schema: T) =>
  schema.superRefine((data, ctx) => {
    if (!data.isPricedItem && (data.price === null || data.price === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '固定價商品需要提供售價',
        path: ['price']
      });
    }

    if (data.isPricedItem && (data.weightPricePerUnit === null || data.weightPricePerUnit === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '秤重商品需要提供每單位價格',
        path: ['weightPricePerUnit']
      });
    }
  });

const createProductSchema = withProductRules(baseProductSchema);
const updateProductSchema = withProductRules(baseProductSchema.partial());

const csvColumns = [
  'id',
  'name',
  'description',
  'category',
  'unit',
  'unitHint',
  'price',
  'nextDayPrice',
  'stock',
  'isAvailable',
  'isPricedItem',
  'weightPricePerUnit',
  'nextDayWeightPricePerUnit',
  'sortOrder',
  'imageUrl',
  'imageKey',
  'options'
] as const;

type CsvRow = Record<(typeof csvColumns)[number], string>;

const toBoolean = (value: string | undefined, defaultValue = false) => {
  if (value === undefined || value === '') return defaultValue;
  return ['1', 'true', 'TRUE', 'yes', 'YES', '是'].includes(value.trim());
};

const toNumber = (value: string | undefined): number | null => {
  if (value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const serializeNumber = (value: number | null | undefined) => (value === null || value === undefined ? '' : value.toString());

export class ProductService {
  private priceCheckService?: PriceCheckService;

  constructor(
    private readonly repository: ProductRepository,
    orderRepository?: OrderRepository
  ) {
    if (orderRepository) {
      this.priceCheckService = new PriceCheckService(orderRepository, repository);
    }
  }

  async list(params?: { keyword?: string; category?: string; onlyAvailable?: boolean }) {
    return await this.repository.list(params);
  }

  async listWithStats() {
    const products = await this.repository.list();

    const total = products.length;
    const available = products.filter(product => product.isAvailable).length;
    const unavailable = total - available;
    const lowStock = products.filter(product => product.stock <= 5).length;
    const variablePrice = products.filter(product => product.isPricedItem).length;
    const fixedPrice = total - variablePrice;
    const categoryCounts = products.reduce<Record<string, number>>((acc, product) => {
      acc[product.category] = (acc[product.category] ?? 0) + 1;
      return acc;
    }, {});

    return {
      products,
      stats: {
        total,
        available,
        unavailable,
        lowStock,
        fixedPrice,
        variablePrice,
        categories: categoryCounts
      }
    };
  }

  async findById(id: string) {
    return await this.repository.findById(id);
  }

  async create(input: unknown) {
    const parsed = createProductSchema.parse(input);
    return await this.repository.create(parsed);
  }

  async update(id: string, input: unknown) {
    const parsed = updateProductSchema.parse(input);
    return await this.repository.update(id, parsed);
  }

  async toggleAvailability(id: string, isAvailable: boolean) {
    return await this.repository.toggleAvailability(id, isAvailable);
  }

  async updateImage(id: string, image: { imageUrl: string; imageKey: string }) {
    return await this.repository.updateImage(id, {
      imageUrl: image.imageUrl,
      imageKey: image.imageKey,
      imageUploadedAt: new Date()
    });
  }

  async bulkUpsert(products: ProductBulkUpsertInput[]) {
    if (products.length === 0) {
      return [];
    }

    const createSchema = withProductRules(baseProductSchema.extend({ id: z.string().uuid().optional() }));
    const updateSchema = withProductRules(baseProductSchema.partial().extend({ id: z.string().uuid() }));

    const parsed = products.map(product => {
      if (product.id) {
        return updateSchema.parse(product);
      }
      return createSchema.parse(product);
    });

    return await this.repository.bulkUpsert(parsed);
  }

  async reorder(items: Array<{ id: string; sortOrder: number }>) {
    if (!items || items.length === 0) {
      return [];
    }

    const reorderSchema = z.array(
      z.object({
        id: z.string().uuid('無效的商品 ID'),
        sortOrder: z.number().int('排序值必須為整數').nonnegative('排序值不可為負數')
      })
    );

    const parsed = reorderSchema.parse(items);
    const updates = parsed.map(item => ({
      id: item.id,
      sortOrder: item.sortOrder
    }));

    return await this.repository.bulkUpdate(updates);
  }

  async exportProductsCsv() {
    const { products } = await this.listWithStats();

    const records = products.map(product => ({
      id: product.id,
      name: product.name,
      description: product.description ?? '',
      category: product.category,
      unit: product.unit,
      unitHint: product.unitHint ?? '',
      price: serializeNumber(product.price),
      nextDayPrice: serializeNumber(product.nextDayPrice ?? null),
      stock: serializeNumber(product.stock),
      isAvailable: product.isAvailable ? '1' : '0',
      isPricedItem: product.isPricedItem ? '1' : '0',
      weightPricePerUnit: serializeNumber(product.weightPricePerUnit ?? null),
      nextDayWeightPricePerUnit: serializeNumber(product.nextDayWeightPricePerUnit ?? null),
      sortOrder: serializeNumber(product.sortOrder),
      imageUrl: product.imageUrl ?? '',
      imageKey: product.imageKey ?? '',
      options: JSON.stringify(product.options.map(option => ({
        id: option.id,
        name: option.name,
        price: option.price
      })))
    } satisfies CsvRow));

    return stringify(records, { header: true, columns: csvColumns });
  }

  async importProductsCsv(file: Buffer) {
    const text = file.toString('utf-8');
    const rows = parse(text, {
      columns: true,
      skip_empty_lines: true,
      bom: true,
      trim: true
    }) as CsvRow[];

    if (rows.length === 0) {
      return [];
    }

    const inputs: ProductBulkUpsertInput[] = rows.map(row => {
      const options = this.parseOptionsFromCsv(row.options);

      return {
        id: row.id?.trim() || undefined,
        name: row.name?.trim() ?? '',
        description: row.description?.trim() || undefined,
        category: row.category?.trim() ?? '',
        unit: row.unit?.trim() ?? '',
        unitHint: row.unitHint?.trim() || undefined,
        price: toNumber(row.price),
        nextDayPrice: toNumber(row.nextDayPrice),
        stock: toNumber(row.stock) ?? 0,
        isAvailable: toBoolean(row.isAvailable, true),
        isPricedItem: toBoolean(row.isPricedItem, false),
        weightPricePerUnit: toNumber(row.weightPricePerUnit),
        nextDayWeightPricePerUnit: toNumber(row.nextDayWeightPricePerUnit),
        sortOrder: toNumber(row.sortOrder) ?? undefined,
        imageUrl: row.imageUrl?.trim() || undefined,
        imageKey: row.imageKey?.trim() || undefined,
        options
      } satisfies ProductBulkUpsertInput;
    });

    return await this.repository.bulkUpsert(inputs);
  }

  private parseOptionsFromCsv(value: string | undefined): ProductOptionInput[] {
    if (!value) return [];

    try {
      const parsed = JSON.parse(value) as Array<{ id?: string; name: string; price?: number | null }>;
      return parsed
        .filter(option => option?.name)
        .map(option => ({
          id: option.id,
          name: option.name,
          price: option.price ?? null
        }));
    } catch (error) {
      throw new Error('商品選項 JSON 解析失敗，請確認格式是否正確');
    }
  }

  async syncNextDayPrices(): Promise<{ updated: number; products: any[] }> {
    const products = await this.repository.list();
    const updates = products.map(product => ({
      id: product.id,
      nextDayPrice: product.price,
      nextDayWeightPricePerUnit: product.weightPricePerUnit
    }));

    const updated = await this.repository.bulkUpdate(updates);
    return { updated: updated.length, products: updated };
  }

  async checkPriceChanges(threshold: number): Promise<PriceChangeReport[]> {
    if (!this.priceCheckService) {
      throw new Error('PriceCheckService is not initialized. OrderRepository is required.');
    }
    return await this.priceCheckService.checkTodayPreOrders(threshold);
  }
}
