'use client';

import { useEffect, useState } from 'react';
import styles from './ProductDetailModal.module.css';

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  unit: string;
  stock: number;
  imageUrl?: string;
  description?: string;
}

interface ProductDetailModalProps {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number) => void;
}

export function ProductDetailModal({ product, open, onClose, onAddToCart }: ProductDetailModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (open) {
      setIsAnimating(true);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuantity(1);
    }
  }, [open, product]);

  if (!product) return null;

  const handleAddToCart = () => {
    onAddToCart(product, quantity);
    onClose();
  };

  const increaseQuantity = () => {
    if (quantity < product.stock) {
      setQuantity(q => q + 1);
    }
  };

  const decreaseQuantity = () => {
    if (quantity > 1) {
      setQuantity(q => q - 1);
    }
  };

  const totalPrice = product.price * quantity;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`${styles.backdrop} ${open ? styles.backdropOpen : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className={`${styles.modal} ${open ? styles.modalOpen : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-modal-title"
      >
        <div className={styles.modalContent}>
          {/* Header */}
          <div className={styles.modalHeader}>
            <button
              className={styles.closeButton}
              onClick={onClose}
              aria-label="關閉"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M18 6L6 18M6 6l12 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          {/* Product Image */}
          <div className={styles.imageSection}>
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className={styles.productImage}
              />
            ) : (
              <div className={styles.imagePlaceholder}>
                <span className={styles.placeholderIcon}>🥬</span>
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className={styles.infoSection}>
            <div className={styles.category}>{product.category}</div>
            <h2 id="product-modal-title" className={styles.title}>
              {product.name}
            </h2>

            {product.description && (
              <p className={styles.description}>{product.description}</p>
            )}

            <div className={styles.priceRow}>
              <div className={styles.priceLabel}>價格</div>
              <div className={styles.priceValue}>
                NT$ {product.price.toLocaleString()} / {product.unit}
              </div>
            </div>

            <div className={styles.stockRow}>
              <div className={styles.stockLabel}>庫存</div>
              <div className={styles.stockValue}>
                約 {Math.max(Math.round(product.stock), 0)} {product.unit}
              </div>
            </div>
          </div>

          {/* Quantity Selector */}
          <div className={styles.quantitySection}>
            <div className={styles.quantityLabel}>數量</div>
            <div className={styles.quantityControls}>
              <button
                className={styles.quantityButton}
                onClick={decreaseQuantity}
                disabled={quantity <= 1}
                aria-label="減少數量"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M5 10h10"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
              <div className={styles.quantityDisplay}>{quantity}</div>
              <button
                className={styles.quantityButton}
                onClick={increaseQuantity}
                disabled={quantity >= product.stock}
                aria-label="增加數量"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M10 5v10M5 10h10"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Footer with Add to Cart */}
          <div className={styles.footer}>
            <div className={styles.totalSection}>
              <div className={styles.totalLabel}>小計</div>
              <div className={styles.totalPrice}>
                NT$ {totalPrice.toLocaleString()}
              </div>
            </div>
            <button
              className={styles.addToCartButton}
              onClick={handleAddToCart}
              disabled={quantity <= 0 || quantity > product.stock}
            >
              <span>加入購物車</span>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M7 18a2 2 0 100-4 2 2 0 000 4zM16 18a2 2 0 100-4 2 2 0 000 4zM1 1h3l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L19 6H5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
