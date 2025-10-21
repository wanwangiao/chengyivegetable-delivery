'use client';

import styles from './ProductCard.module.css';

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  unit: string;
  stock: number;
  imageUrl?: string;
}

interface ProductCardProps {
  product: Product;
  onClick: () => void;
}

export function ProductCard({ product, onClick }: ProductCardProps) {
  const isLowStock = product.stock < 5;
  const isOutOfStock = product.stock <= 0;

  return (
    <article
      className={styles.card}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={`查看 ${product.name} 詳情`}
    >
      {/* Image Section */}
      <div className={styles.imageWrapper}>
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className={styles.image}
            loading="lazy"
          />
        ) : (
          <div className={styles.placeholder}>
            <span className={styles.placeholderIcon}>🥬</span>
          </div>
        )}

        {/* Status Badge */}
        {isOutOfStock && (
          <div className={styles.badge}>
            <span className={styles.badgeText}>售完</span>
          </div>
        )}
        {!isOutOfStock && isLowStock && (
          <div className={`${styles.badge} ${styles.badgeWarning}`}>
            <span className={styles.badgeText}>剩餘少量</span>
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className={styles.content}>
        {/* Category */}
        <div className={styles.category}>{product.category}</div>

        {/* Product Name */}
        <h3 className={styles.title}>{product.name}</h3>

        {/* Price Row */}
        <div className={styles.priceRow}>
          <div className={styles.priceWrapper}>
            <span className={styles.currency}>NT$</span>
            <span className={styles.price}>{product.price.toLocaleString()}</span>
            <span className={styles.unit}>/ {product.unit}</span>
          </div>
        </div>

        {/* Stock Info */}
        <div className={styles.stockInfo}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={styles.stockIcon}>
            <path
              d="M14 7V11C14 12.1046 13.1046 13 12 13H4C2.89543 13 2 12.1046 2 11V7M14 7L12 3H4L2 7M14 7H2"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className={styles.stockText}>
            庫存 {Math.max(Math.round(product.stock), 0)} {product.unit}
          </span>
        </div>

        {/* Tap Indicator */}
        <div className={styles.tapIndicator}>
          <span className={styles.tapText}>點擊查看</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M6 12l4-4-4-4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </article>
  );
}
