'use client';

import { type CSSProperties } from 'react';

type FloatingCartBarProps = {
  itemCount: number;
  totalAmount: number;
  onClick: () => void;
};

export function FloatingCartBar({ itemCount, totalAmount, onClick }: FloatingCartBarProps) {
  if (itemCount === 0) {
    return null; // 空購物車時隱藏
  }

  return (
    <div style={styles.container} onClick={onClick}>
      <div style={styles.content}>
        <div style={styles.leftSection}>
          <span style={styles.icon}>🛒</span>
          <span style={styles.itemCount}>已選 {itemCount} 件商品</span>
        </div>
        <div style={styles.rightSection}>
          <span style={styles.amount}>小計 NT${totalAmount.toLocaleString()}</span>
          <span style={styles.arrow}>查看詳情 ›</span>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    position: 'fixed',
    bottom: '20px',
    left: '16px',
    right: '16px',
    height: '80px',

    backgroundColor: '#fff',
    borderRadius: '16px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08)',

    padding: '12px 16px',
    cursor: 'pointer',
    zIndex: 100,

    transition: 'all 0.2s ease',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    height: '100%',
    justifyContent: 'center',
  },
  leftSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  icon: {
    fontSize: '20px',
  },
  itemCount: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#2d3748',
  },
  rightSection: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amount: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#7cb342',
  },
  arrow: {
    fontSize: '14px',
    color: '#7cb342',
    fontWeight: '500',
  },
};

// 添加懸停效果 (僅桌面端)
if (typeof window !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @media (min-width: 768px) {
      .floating-cart-bar:hover {
        transform: translateY(-2px);
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.16), 0 4px 12px rgba(0, 0, 0, 0.12);
      }

      /* 桌面端改為右下角 */
      .floating-cart-bar-desktop {
        left: auto !important;
        right: 24px !important;
        width: 360px !important;
      }
    }
  `;
  document.head.appendChild(style);
}
