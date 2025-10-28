'use client';

import { useEffect, useState } from 'react';
import styles from './BusinessStatusBanner.module.css';
import { BusinessCalendarModal } from './BusinessCalendarModal';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3000/api/v1';

type OrderStatus = 'current-day' | 'next-day' | 'preparation' | 'closed';

interface StatusConfig {
  type: OrderStatus;
  title: string;
  message: string;
  icon: string;
  actionText?: string;
}

interface SystemConfig {
  currentOrderStartTime: string;
  currentOrderEndTime: string;
  preOrderStartTime: string;
  preOrderEndTime: string;
}

const REGULAR_CLOSED_DAYS = [1, 4]; // Monday (1), Thursday (4)

function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

function getTimeInMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function isRestDay(date: Date): boolean {
  const dayOfWeek = date.getDay();
  return REGULAR_CLOSED_DAYS.includes(dayOfWeek);
}

function determineOrderStatus(now: Date, config: SystemConfig): StatusConfig {
  const timeInMinutes = getTimeInMinutes(now);

  // 店休日檢查
  if (isRestDay(now)) {
    return {
      type: 'closed',
      title: '今日店休',
      message: '每週一、週四固定公休，歡迎明日再來選購新鮮蔬果',
      icon: '🌙',
      actionText: '查看行事曆'
    };
  }

  const currentStart = timeToMinutes(config.currentOrderStartTime);
  const currentEnd = timeToMinutes(config.currentOrderEndTime);
  const preOrderStart = timeToMinutes(config.preOrderStartTime);
  const preOrderEnd = timeToMinutes(config.preOrderEndTime);

  // 當日訂單時段
  if (timeInMinutes >= currentStart && timeInMinutes < currentEnd) {
    const endTime = config.currentOrderEndTime;
    return {
      type: 'current-day',
      title: '當日訂單開放中',
      message: `🚀 ${endTime} 前下單，今日新鮮配送到府`,
      icon: '✨',
      actionText: '查看行事曆'
    };
  }

  // 備貨時段（當日訂單結束 到 預訂開始之間）
  if (timeInMinutes >= currentEnd && timeInMinutes < preOrderStart) {
    const preOrderStartFormatted = config.preOrderStartTime;
    return {
      type: 'preparation',
      title: '備貨中 - 當日訂單已截止',
      message: `下午 ${preOrderStartFormatted} 開放隔天預訂，敬請期待`,
      icon: '📦',
      actionText: '查看行事曆'
    };
  }

  // 預訂時段
  if (timeInMinutes >= preOrderStart && timeInMinutes <= preOrderEnd) {
    return {
      type: 'next-day',
      title: '明日配送 - 預訂開放中',
      message: '🌱 現在下單，明天新鮮送達',
      icon: '📅',
      actionText: '查看行事曆'
    };
  }

  // 凌晨到當日訂單開始前
  if (timeInMinutes >= 0 && timeInMinutes < currentStart) {
    const startTime = config.currentOrderStartTime;
    return {
      type: 'preparation',
      title: '準備中',
      message: `早上 ${startTime} 開放當日訂單`,
      icon: '🌅',
      actionText: '查看行事曆'
    };
  }

  // 預訂時段結束後到午夜
  return {
    type: 'preparation',
    title: '暫停接單',
    message: `營業時間：週二至週日 ${config.currentOrderStartTime}-${config.currentOrderEndTime}（當日）、${config.preOrderStartTime}-${config.preOrderEndTime}（隔日）`,
    icon: '⏰',
    actionText: '查看行事曆'
  };
}

export function BusinessStatusBanner() {
  const [status, setStatus] = useState<StatusConfig | null>(null);
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch(`${API_BASE}/admin/settings`);
        if (!response.ok) throw new Error('Failed to load config');
        const json = (await response.json()) as { data: SystemConfig };
        setConfig(json.data);
      } catch (error) {
        console.error('載入營業時間設定失敗:', error);
        // 使用預設值
        setConfig({
          currentOrderStartTime: '07:30',
          currentOrderEndTime: '11:00',
          preOrderStartTime: '14:00',
          preOrderEndTime: '23:59'
        });
      }
    };

    loadConfig();
  }, []);

  useEffect(() => {
    if (!config) return;

    const updateStatus = () => {
      const now = new Date();
      const newStatus = determineOrderStatus(now, config);
      setStatus(newStatus);
    };

    updateStatus();

    // 每分鐘更新一次狀態
    const interval = setInterval(updateStatus, 60000);

    return () => clearInterval(interval);
  }, [config]);

  if (!status) {
    return null;
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

      <BusinessCalendarModal open={calendarOpen} onClose={() => setCalendarOpen(false)} />
    </>
  );
}
