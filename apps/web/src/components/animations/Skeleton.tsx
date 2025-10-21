'use client';

import styles from './Skeleton.module.css';

interface SkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  className?: string;
  animation?: 'pulse' | 'wave' | 'none';
}

export function Skeleton({
  variant = 'text',
  width,
  height,
  className = '',
  animation = 'wave'
}: SkeletonProps) {
  const style: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height
  };

  return (
    <div
      className={`
        ${styles.skeleton}
        ${styles[variant]}
        ${animation !== 'none' ? styles[animation] : ''}
        ${className}
      `}
      style={style}
      aria-hidden="true"
    />
  );
}

// 產品卡片骨架屏
export function ProductCardSkeleton() {
  return (
    <div className={styles.productCardSkeleton}>
      <Skeleton variant="rounded" width={100} height={100} />
      <div className={styles.productCardContent}>
        <Skeleton variant="text" width="60%" height={12} />
        <Skeleton variant="text" width="80%" height={20} />
        <Skeleton variant="text" width="40%" height={16} />
      </div>
    </div>
  );
}

// 列表骨架屏
export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className={styles.listSkeleton}>
      {Array.from({ length: count }).map((_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  );
}
