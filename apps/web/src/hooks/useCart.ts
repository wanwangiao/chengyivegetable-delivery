'use client';

import { useEffect, useState, useCallback } from 'react';
import { ensureNumber, ensurePositiveInteger } from '../utils/currency';

export type CartItem = {
  id: string;
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  unit: string;
  lineTotal: number;
};

const CART_STORAGE_KEY = 'cart';
const DELIVERY_FEE = 60;
const FREE_SHIPPING_THRESHOLD = 200;

type StoredCartItem = Partial<CartItem> | null | undefined;

const sanitizeCartItem = (item: StoredCartItem): CartItem | null => {
  if (!item) return null;

  const productId = item.productId ?? item.id;
  const name = item.name;
  const unit = item.unit;

  if (!productId || !name || !unit) {
    return null;
  }

  const quantity = ensurePositiveInteger(item.quantity, 1);
  const unitPrice = ensureNumber(item.unitPrice, 0);
  const lineTotal = ensureNumber(item.lineTotal, unitPrice * quantity);
  const id = item.id ?? `${productId}-${Date.now()}`;

  return {
    id: String(id),
    productId: String(productId),
    name: String(name),
    unit: String(unit),
    quantity,
    unitPrice,
    lineTotal
  };
};

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // 從 localStorage 載入購物車
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as StoredCartItem[] | unknown;
        const list = Array.isArray(parsed) ? parsed : [];

        const sanitized = list
          .map(sanitizeCartItem)
          .filter((item): item is CartItem => item !== null);

        setItems(sanitized);
      }
    } catch (error) {
      console.error('Failed to load cart:', error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // 寫回 localStorage
  useEffect(() => {
    if (!isLoaded) return;

    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      console.error('Failed to save cart:', error);
    }
  }, [items, isLoaded]);

  // 移除單一商品
  const removeItem = useCallback((itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
  }, []);

  // 新增商品
  const addItem = useCallback((product: {
    id: string;
    name: string;
    price: number | null | undefined;
    unit: string;
  }) => {
    const unitPrice = ensureNumber(product.price, 0);

    setItems(prev => {
      const existingIndex = prev.findIndex(item => item.productId === product.id);

      if (existingIndex >= 0) {
        const updated = [...prev];
        const existing = updated[existingIndex];
        const nextQuantity = ensurePositiveInteger(existing.quantity + 1, 1);
        const normalizedUnitPrice = ensureNumber(existing.unitPrice, unitPrice);

        updated[existingIndex] = {
          ...existing,
          quantity: nextQuantity,
          lineTotal: normalizedUnitPrice * nextQuantity
        };

        return updated;
      }

      return [
        ...prev,
        {
          id: `${product.id}-${Date.now()}`,
          productId: product.id,
          name: product.name,
          unitPrice,
          quantity: 1,
          unit: product.unit,
          lineTotal: unitPrice
        }
      ];
    });
  }, []);

  // 更新商品數量
  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    const normalizedQuantity = ensurePositiveInteger(quantity, 0);

    if (normalizedQuantity <= 0) {
      removeItem(itemId);
      return;
    }

    setItems(prev =>
      prev.map(item =>
        item.id === itemId
          ? {
              ...item,
              quantity: normalizedQuantity,
              lineTotal: ensureNumber(item.unitPrice, 0) * normalizedQuantity
            }
          : item
      )
    );
  }, [removeItem]);

  // 清空購物車
  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  // 計算統計數據
  const subtotal = items.reduce((sum, item) => sum + ensureNumber(item.lineTotal, 0), 0);
  const deliveryFee = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : DELIVERY_FEE;
  const totalAmount = subtotal + deliveryFee;
  const itemCount = items.reduce((sum, item) => sum + ensurePositiveInteger(item.quantity, 0), 0);
  const isFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD;
  const amountToFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);

  return {
    items,
    itemCount,
    subtotal,
    deliveryFee,
    totalAmount,
    isFreeShipping,
    amountToFreeShipping,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    isLoaded
  };
}
