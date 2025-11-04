'use client';

import { useEffect, useState } from 'react';
import styles from './BusinessStatusBanner.module.css';
import { OrderTrackingModal } from './OrderTrackingModal';
import { BusinessCalendarModal } from './BusinessCalendarModal';

import { API_BASE_URL as API_BASE } from '../config/api';

type OrderStatus = 'current-day' | 'next-day' | 'preparation' | 'closed';

interface StatusConfig {
  type: OrderStatus;
  title: string;
  message: string;
  icon: string;
  actionText?: string;
}

interface BusinessStatus {
  isOpen: boolean;
  orderWindow: 'CURRENT_DAY' | 'NEXT_DAY' | 'CLOSED';
  message: string;
  nextOpenTime?: string;
}

function mapBusinessStatusToConfig(businessStatus: BusinessStatus): StatusConfig {
  // 店休狀態
  if (!businessStatus.isOpen) {
    return {
      type: 'closed',
      title: '暫停營業',
      message: businessStatus.message,
      icon: '🌙',
      actionText: '訂單查詢'
    };
  }

  // 當日訂單時段
  if (businessStatus.orderWindow === 'CURRENT_DAY') {
    return {
      type: 'current-day',
      title: '當日訂單開放中',
      message: businessStatus.message,
      icon: '✨',
      actionText: '訂單查詢'
    };
  }

  // 預訂時段
  if (businessStatus.orderWindow === 'NEXT_DAY') {
    return {
      type: 'next-day',
      title: '明日配送 - 預訂開放中',
      message: businessStatus.message,
      icon: '📅',
      actionText: '訂單查詢'
    };
  }

  // 備貨/準備時段
  return {
    type: 'preparation',
    title: '準備中',
    message: businessStatus.message,
    icon: '📦',
    actionText: '訂單查詢'
  };
}

export function BusinessStatusBanner() {
  const [status, setStatus] = useState<StatusConfig | null>(null);
  const [orderTrackingOpen, setOrderTrackingOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  useEffect(() => {
    const loadBusinessStatus = async () => {
      try {
        const response = await fetch(`${API_BASE}/business-hours/status`);
        if (!response.ok) throw new Error('Failed to load business status');
        const json = await response.json();

        if (json.success && json.data) {
          const statusConfig = mapBusinessStatusToConfig(json.data);
          setStatus(statusConfig);
        }
      } catch (error) {
        console.error('載入營業狀態失敗:', error);
        // 顯示預設的關閉狀態
        setStatus({
          type: 'closed',
          title: '暫停營業',
          message: '目前無法取得營業狀態，請稍後再試',
          icon: '⏰',
          actionText: '訂單查詢'
        });
      }
    };

    loadBusinessStatus();

    // 每分鐘更新一次狀態
    const interval = setInterval(loadBusinessStatus, 60000);

    return () => clearInterval(interval);
  }, []);

  if (!status) {
    return null;
  }

  return (
    <>
      <div className={`${styles.banner} ${styles[status.type]}`} role="status" aria-live="polite">
        <div className={styles.content}>
          <button
            className={styles.iconButton}
            onClick={() => setCalendarOpen(true)}
            type="button"
            aria-label="查看行事曆"
          >
            <span className={styles.icon}>{status.icon}</span>
          </button>
          <div className={styles.textContent}>
            <h2 className={styles.title}>{status.title}</h2>
            <p className={styles.message}>{status.message}</p>
          </div>
          {status.actionText && (
            <button
              className={styles.actionButton}
              onClick={() => setOrderTrackingOpen(true)}
              type="button"
            >
              {status.actionText}
            </button>
          )}
        </div>
      </div>

      <OrderTrackingModal open={orderTrackingOpen} onClose={() => setOrderTrackingOpen(false)} />
      <BusinessCalendarModal open={calendarOpen} onClose={() => setCalendarOpen(false)} />
    </>
  );
}
