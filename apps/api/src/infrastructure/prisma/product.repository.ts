import type { Prisma } from '@prisma/client';
import { prisma } from './client';

const productInclude = {
  options: {
    orderBy: [
      { sortOrder: 'asc' },
      { createdAt: 'asc' }
    ]
  }
} as const;

type ProductRecord = Prisma.ProductGetPayload<{ include: typeof productInclude }>;
type ProductOptionRecord = Prisma.ProductOptionGetPayload<{}>;

const toNullableNumber = (value: Prisma.Decimal | null | undefined) => {
  return value === null || value === undefined ? null : Number(value);
};

const mapOption = (option: ProductOptionRecord): ProductOption => ({
  id: option.id,
  name: option.name,
  price: toNullableNumber(option.price),
  groupName: option.groupName ?? undefined,
  isRequired: option.isRequired,
  sortOrder: option.sortOrder
});

const mapProduct = (product: ProductRecord): Product => ({
  id: product.id,
  name: product.name,
  description: product.description ?? undefined,
  category: product.category,
  unit: product.unit,
  unitHint: product.unitHint ?? undefined,
  price: toNullableNumber(product.price),
  nextDayPrice: toNullableNumber(product.nextDayPrice),
  stock: product.stock,
  isAvailable: product.isAvailable,
  isPricedItem: product.isPricedItem,
  weightPricePerUnit: toNullableNumber(product.weightPricePerUnit),
  nextDayWeightPricePerUnit: toNullableNumber(product.nextDayWeightPricePerUnit),
  sortOrder: product.sortOrder,
  imageUrl: product.imageUrl ?? undefined,
  imageKey: product.imageKey ?? undefined,
  imageUploadedAt: product.imageUploadedAt ?? undefined,
  options: product.options?.map(mapOption) ?? []
});

const buildCreateData = (input: ProductCreateInput): Prisma.ProductCreateInput => ({
  name: input.name,
  description: input.description,
  category: input.category,
  unit: input.unit,
  unitHint: input.unitHint,
  price: input.price ?? null,
  nextDayPrice: input.nextDayPrice ?? null,
  stock: input.stock,
  isAvailable: input.isAvailable,
  isPricedItem: input.isPricedItem,
  weightPricePerUnit: input.weightPricePerUnit ?? null,
  nextDayWeightPricePerUnit: input.nextDayWeightPricePerUnit ?? null,
  sortOrder: input.sortOrder ?? 0,
  imageUrl: input.imageUrl,
  imageKey: input.imageKey,
  imageUploadedAt: input.imageUploadedAt ?? (input.imageUrl ? new Date() : null),
  options: input.options
    ? {
        create: input.options.map(option => ({
          name: option.name,
          price: option.price ?? null,
          groupName: option.groupName ?? null,
          isRequired: option.isRequired ?? false,
          sortOrder: option.sortOrder ?? 0
        }))
      }
    : undefined
});

const buildUpdateData = (input: ProductUpdateInput): Prisma.ProductUpdateInput => {
  const data: Prisma.ProductUpdateInput = {};

  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.category !== undefined) data.category = input.category;
  if (input.unit !== undefined) data.unit = input.unit;
  if (input.unitHint !== undefined) data.unitHint = input.unitHint;
  if (input.price !== undefined) data.price = input.price;
  if (input.nextDayPrice !== undefined) data.nextDayPrice = input.nextDayPrice;
  if (input.stock !== undefined) data.stock = input.stock;
  if (input.isAvailable !== undefined) data.isAvailable = input.isAvailable;
  if (input.isPricedItem !== undefined) data.isPricedItem = input.isPricedItem;
  if (input.weightPricePerUnit !== undefined) data.weightPricePerUnit = input.weightPricePerUnit;
  if (input.nextDayWeightPricePerUnit !== undefined) data.nextDayWeightPricePerUnit = input.nextDayWeightPricePerUnit;
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
  if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl;
  if (input.imageKey !== undefined) data.imageKey = input.imageKey;
  if (input.imageUploadedAt !== undefined) data.imageUploadedAt = input.imageUploadedAt;

  return data;
};

const syncOptions = async (tx: Prisma.TransactionClient, productId: string, options: ProductOptionInput[] | undefined) => {
  if (!options) return;

  const idsToKeep = options.filter(option => option.id).map(option => option.id!) as string[];

  if (idsToKeep.length > 0) {
    await tx.productOption.deleteMany({
      where: {
        productId,
        id: {
          notIn: idsToKeep
        }
      }
    });
  } else {
    await tx.productOption.deleteMany({ where: { productId } });
  }

  for (const option of options) {
    if (option.id) {
      await tx.productOption.upsert({
        where: { id: option.id },
        update: {
          name: option.name,
          price: option.price ?? null,
          groupName: option.groupName ?? null,
          isRequired: option.isRequired ?? false,
          sortOrder: option.sortOrder ?? 0
        },
        create: {
          id: option.id,
          productId,
          name: option.name,
          price: option.price ?? null,
          groupName: option.groupName ?? null,
          isRequired: option.isRequired ?? false,
          sortOrder: option.sortOrder ?? 0
        }
      });
    } else {
      await tx.productOption.create({
        data: {
          productId,
          name: option.name,
          price: option.price ?? null,
          groupName: option.groupName ?? null,
          isRequired: option.isRequired ?? false,
          sortOrder: option.sortOrder ?? 0
        }
      });
    }
  }
};

export interface ProductOption {
  id: string;
  name: string;
  price: number | null;
  groupName?: string;
  isRequired: boolean;
  sortOrder: number;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  category: string;
  unit: string;
  unitHint?: string;
  price: number | null;
  nextDayPrice?: number | null;
  stock: number;
  isAvailable: boolean;
  isPricedItem: boolean;
  weightPricePerUnit?: number | null;
  nextDayWeightPricePerUnit?: number | null;
  sortOrder: number;
  imageUrl?: string;
  imageKey?: string;
  imageUploadedAt?: Date;
  options: ProductOption[];
}

export interface ProductOptionInput {
  id?: string;
  name: string;
  price?: number | null;
  groupName?: string;
  isRequired?: boolean;
  sortOrder?: number;
}

export interface ProductCreateInput {
  name: string;
  description?: string;
  category: string;
  unit: string;
  unitHint?: string;
  price?: number | null;
  nextDayPrice?: number | null;
  stock: number;
  isAvailable: boolean;
  isPricedItem: boolean;
  weightPricePerUnit?: number | null;
  nextDayWeightPricePerUnit?: number | null;
  sortOrder?: number;
  imageUrl?: string;
  imageKey?: string;
  imageUploadedAt?: Date;
  options?: ProductOptionInput[];
}

export interface ProductUpdateInput extends Partial<ProductCreateInput> {
  options?: ProductOptionInput[];
}

export interface ProductBulkUpsertInput extends ProductUpdateInput {
  id?: string;
}

export interface ProductRepository {
  list(params?: { keyword?: string; category?: string; onlyAvailable?: boolean }): Promise<Product[]>;
  findById(id: string): Promise<Product | null>;
  create(input: ProductCreateInput): Promise<Product>;
  update(id: string, input: ProductUpdateInput): Promise<Product>;
  toggleAvailability(id: string, isAvailable: boolean): Promise<Product>;
  updateImage(id: string, image: { imageUrl: string; imageKey: string; imageUploadedAt?: Date }): Promise<Product>;
  bulkUpsert(inputs: ProductBulkUpsertInput[]): Promise<Product[]>;
  bulkUpdate(updates: Array<{ id: string; [key: string]: any }>): Promise<Product[]>;
}

const applyFilters = (params?: { keyword?: string; category?: string; onlyAvailable?: boolean }): Prisma.ProductWhereInput => {
  const where: Prisma.ProductWhereInput = {};

  if (params?.keyword) {
    where.OR = [
      { name: { contains: params.keyword, mode: 'insensitive' } },
      { description: { contains: params.keyword, mode: 'insensitive' } }
    ];
  }

  if (params?.category) {
    where.category = params.category;
  }

  if (params?.onlyAvailable) {
    where.isAvailable = true;
  }

  return where;
};

export const prismaProductRepository: ProductRepository = {
  async list(params) {
    const products = await prisma.product.findMany({
      where: applyFilters(params),
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: productInclude
    });

    return products.map(mapProduct);
  },

  async findById(id) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: productInclude
    });

    return product ? mapProduct(product) : null;
  },

  async create(input) {
    const created = await prisma.product.create({
      data: buildCreateData(input),
      include: productInclude
    });

    return mapProduct(created);
  },

  async update(id, input) {
    const result = await prisma.$transaction(async tx => {
      await tx.product.update({
        where: { id },
        data: buildUpdateData(input)
      });

      await syncOptions(tx, id, input.options);

      const updated = await tx.product.findUnique({
        where: { id },
        include: productInclude
      });

      if (!updated) {
        throw new Error('PRODUCT_NOT_FOUND');
      }

      return updated;
    });

    return mapProduct(result);
  },

  async toggleAvailability(id, isAvailable) {
    const updated = await prisma.product.update({
      where: { id },
      data: { isAvailable },
      include: productInclude
    });

    return mapProduct(updated);
  },

  async updateImage(id, image) {
    const updated = await prisma.product.update({
      where: { id },
      data: {
        imageUrl: image.imageUrl,
        imageKey: image.imageKey,
        imageUploadedAt: image.imageUploadedAt ?? new Date()
      },
      include: productInclude
    });

    return mapProduct(updated);
  },

  async bulkUpsert(inputs) {
    if (inputs.length === 0) return [];

    const products = await prisma.$transaction(async tx => {
      const records: ProductRecord[] = [];

      for (const input of inputs) {
        const { id, options, ...rest } = input;

        if (id) {
          await tx.product.update({
            where: { id },
            data: buildUpdateData(rest)
          });

          await syncOptions(tx, id, options);

          const updated = await tx.product.findUnique({
            where: { id },
            include: productInclude
          });

          if (updated) {
            records.push(updated);
          }
        } else {
          const created = await tx.product.create({
            data: buildCreateData({
              ...(rest as ProductCreateInput),
              options
            })
          });

          await syncOptions(tx, created.id, options);

          const refreshed = await tx.product.findUnique({
            where: { id: created.id },
            include: productInclude
          });

          if (refreshed) {
            records.push(refreshed);
          }
        }
      }

      return records;
    });

    return products.map(mapProduct);
  },

  async bulkUpdate(updates) {
    if (updates.length === 0) return [];

    // Use transaction for better performance and atomicity
    const results = await prisma.$transaction(
      updates.map(update => {
        const { id, ...data } = update;
        return prisma.product.update({
          where: { id },
          data: buildUpdateData(data as ProductUpdateInput),
          include: productInclude
        });
      })
    );

    return results.map(mapProduct);
  }
};
