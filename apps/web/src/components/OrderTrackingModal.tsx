'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './OrderTrackingModal.module.css';

interface OrderTrackingModalProps {
  open: boolean;
  onClose: () => void;
}

export function OrderTrackingModal({ open, onClose }: OrderTrackingModalProps) {
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!orderNumber.trim()) {
      alert('請輸入訂單編號');
      return;
    }

    // 關閉彈窗並導航到訂單追蹤頁面
    onClose();
    router.push(`/order-tracking?orderId=${encodeURIComponent(orderNumber.trim())}`);
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className={styles.backdrop} onClick={onClose} />

      {/* Modal */}
      <div className={styles.modal}>
        <div className={styles.modalContent}>
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.headerTop}>
              <h2 className={styles.title}>訂單查詢</h2>
              <button
                type="button"
                className={styles.closeButton}
                onClick={onClose}
                aria-label="關閉"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="order-number" className={styles.label}>
                訂單編號
              </label>
              <input
                id="order-number"
                type="text"
                className={styles.input}
                placeholder="請輸入訂單編號"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                autoFocus
              />
              <p className={styles.hint}>
                您可以在訂單確認簡訊或 Email 中找到訂單編號
              </p>
            </div>

            <button type="submit" className={styles.submitButton}>
              查詢訂單
            </button>
          </form>

          {/* Info */}
          <div className={styles.infoSection}>
            <p className={styles.infoText}>
              💡 <strong>小提示：</strong>輸入訂單編號後，即可查看訂單狀態、配送進度及司機位置
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
