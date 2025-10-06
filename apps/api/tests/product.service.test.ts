import { describe, expect, it, vi } from 'vitest';
import { ProductService } from '../src/domain/product-service';

const repository = {
  list: vi.fn(async () => [
    {
      id: '1',
      name: '小黃瓜',
      description: null,
      category: '葉菜類',
      unit: '斤',
      price: 80,
      stock: 10,
      isAvailable: true,
      imageUrl: null
    },
    {
      id: '2',
      name: '馬鈴薯',
      description: null,
      category: '根莖類',
      unit: '斤',
      price: 65,
      stock: 4,
      isAvailable: false,
      imageUrl: null
    }
  ])
};

describe('ProductService', () => {
  const service = new ProductService(repository as any);

  it('computes admin stats correctly', async () => {
    const { products, stats } = await service.listWithStats();

    expect(products).toHaveLength(2);
    expect(stats.total).toBe(2);
    expect(stats.available).toBe(1);
    expect(stats.unavailable).toBe(1);
    expect(stats.lowStock).toBe(1);
    expect(stats.categories['葉菜類']).toBe(1);
    expect(stats.categories['根莖類']).toBe(1);
  });
});
