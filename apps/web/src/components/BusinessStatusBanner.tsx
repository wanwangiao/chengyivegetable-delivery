'use client';

import { useEffect, useState } from 'react';
import styles from './BusinessStatusBanner.module.css';
import { BusinessCalendarModal } from './BusinessCalendarModal';

type OrderStatus =
  | 'current-day'      // 7:30 AM - 10:00 AM: 當天訂單
  | 'next-day'         // 2:00 PM - 12:00 AM: 預訂隔天
  | 'preparation'      // 10:00 AM - 2:00 PM: 準備中
  | 'closed';          // 週一、週四或特殊休假日

interface StatusConfig {
  type: OrderStatus;
  title: string;
  message: string;
  icon: string;
  actionText?: string;
}

const REGULAR_CLOSED_DAYS = [1, 4]; // Monday (1), Thursday (4)

function getTimeInMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function isRestDay(date: Date): boolean {
  const dayOfWeek = date.getDay();
  return REGULAR_CLOSED_DAYS.includes(dayOfWeek);
}

function determineOrderStatus(now: Date): StatusConfig {
  const dayOfWeek = now.getDay();
  const timeInMinutes = getTimeInMinutes(now);

  // Check if it's a rest day (Monday or Thursday)
  if (isRestDay(now)) {
    return {
      type: 'closed',
      title: '今日店休',
      message: '每週一、週四固定公休，歡迎明日再來選購新鮮蔬果',
      icon: '🌙',
      actionText: '查看行事曆'
    };
  }

  // Current day orders: 7:30 AM - 10:00 AM (450 - 600 minutes)
  if (timeInMinutes >= 450 && timeInMinutes < 600) {
    return {
      type: 'current-day',
      title: '當日訂單開放中',
      message: '🚀 10:00 前下單，今日新鮮配送到府',
      icon: '✨',
      actionText: '查看行事曆'
    };
  }

  // Preparation period: 10:00 AM - 2:00 PM (600 - 840 minutes)
  if (timeInMinutes >= 600 && timeInMinutes < 840) {
    return {
      type: 'preparation',
      title: '備貨中 - 當日訂單已截止',
      message: '下午 2 點開放隔天預訂，敬請期待',
      icon: '📦',
      actionText: '查看行事曆'
    };
  }

  // Next day pre-orders: 2:00 PM - 11:59 PM (840 - 1439 minutes)
  if (timeInMinutes >= 840 && timeInMinutes <= 1439) {
    return {
      type: 'next-day',
      title: '明日配送 - 預訂開放中',
      message: '🌱 現在下單，明天新鮮送達',
      icon: '📅',
      actionText: '查看行事曆'
    };
  }

  // After midnight to 7:30 AM (0 - 449 minutes)
  if (timeInMinutes >= 0 && timeInMinutes < 450) {
    return {
      type: 'preparation',
      title: '準備中',
      message: '早上 7:30 開放當日訂單',
      icon: '🌅',
      actionText: '查看行事曆'
    };
  }

  // Default fallback (should not reach here)
  return {
    type: 'preparation',
    title: '暫停接單',
    message: '營業時間：週二至週日 07:30-10:00（當日）、14:00-24:00（隔日）',
    icon: '⏰',
    actionText: '查看行事曆'
  };
}

export function BusinessStatusBanner() {
  const [status, setStatus] = useState<StatusConfig | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  useEffect(() => {
    // Initial status check
    const updateStatus = () => {
      const now = new Date();
      const newStatus = determineOrderStatus(now);
      setStatus(newStatus);
    };

    updateStatus();

    // Update status every minute
    const interval = setInterval(updateStatus, 60000);

    return () => clearInterval(interval);
  }, []);

  if (!status) {
    return null; // Don't render until status is determined
  }

  return (
    <>
      <div className={`${styles.banner} ${styles[status.type]}`} role="status" aria-live="polite">
        <div className={styles.content}>
          <div className={styles.iconWrapper}>
            <span className={styles.icon}>{status.icon}</span>
          </div>
          <div className={styles.textContent}>
            <h2 className={styles.title}>{status.title}</h2>
            <p className={styles.message}>{status.message}</p>
          </div>
          {status.actionText && (
            <button
              className={styles.actionButton}
              onClick={() => setCalendarOpen(true)}
              type="button"
            >
              {status.actionText}
            </button>
          )}
        </div>
      </div>

      {/* Calendar Modal */}
      <BusinessCalendarModal open={calendarOpen} onClose={() => setCalendarOpen(false)} />
    </>
  );
}
