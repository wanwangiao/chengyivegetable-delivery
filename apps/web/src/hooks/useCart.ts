'use client';

import { useEffect, useState, useCallback } from 'react';

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

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // 從 localStorage 載入購物車
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as CartItem[];
        setItems(parsed);
      }
    } catch (error) {
      console.error('Failed to load cart:', error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // 儲存到 localStorage
  useEffect(() => {
    if (isLoaded) {
      try {
        window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
      } catch (error) {
        console.error('Failed to save cart:', error);
      }
    }
  }, [items, isLoaded]);

  // 加入商品
  const addItem = useCallback((product: {
    id: string;
    name: string;
    price: number;
    unit: string;
  }) => {
    setItems(prev => {
      const existingIndex = prev.findIndex(item => item.productId === product.id);

      if (existingIndex >= 0) {
        // 商品已存在，數量 +1
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + 1,
          lineTotal: updated[existingIndex].unitPrice * (updated[existingIndex].quantity + 1),
        };
        return updated;
      } else {
        // 新商品
        return [
          ...prev,
          {
            id: `${product.id}-${Date.now()}`,
            productId: product.id,
            name: product.name,
            unitPrice: product.price,
            quantity: 1,
            unit: product.unit,
            lineTotal: product.price,
          },
        ];
      }
    });
  }, []);

  // 更新數量
  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    if (quantity <= 0) {
      // 數量為 0 則移除
      removeItem(itemId);
      return;
    }

    setItems(prev =>
      prev.map(item =>
        item.id === itemId
          ? {
              ...item,
              quantity,
              lineTotal: item.unitPrice * quantity,
            }
          : item
      )
    );
  }, []);

  // 移除商品
  const removeItem = useCallback((itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
  }, []);

  // 清空購物車
  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  // 計算總計
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const deliveryFee = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : DELIVERY_FEE;
  const totalAmount = subtotal + deliveryFee;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
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
    isLoaded,
  };
}
