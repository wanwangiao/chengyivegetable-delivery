'use client';

import { useEffect, useState } from 'react';
import styles from './BusinessCalendarModal.module.css';

interface BusinessCalendarModalProps {
  open: boolean;
  onClose: () => void;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isRestDay: boolean;
  isSpecialDate: boolean;
  specialReason?: string;
}

const REGULAR_CLOSED_DAYS = [1, 4]; // Monday (1), Thursday (4)
const MONTHS = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

function generateCalendarDays(year: number, month: number): CalendarDay[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days: CalendarDay[] = [];

  // Add days from previous month
  const firstDayOfWeek = firstDay.getDay();
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const date = new Date(year, month, -i);
    days.push({
      date,
      isCurrentMonth: false,
      isToday: isSameDay(date, today),
      isRestDay: REGULAR_CLOSED_DAYS.includes(date.getDay()),
      isSpecialDate: false
    });
  }

  // Add days from current month
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(year, month, day);
    days.push({
      date,
      isCurrentMonth: true,
      isToday: isSameDay(date, today),
      isRestDay: REGULAR_CLOSED_DAYS.includes(date.getDay()),
      isSpecialDate: false
    });
  }

  // Add days from next month
  const remainingDays = 42 - days.length; // 6 rows × 7 days
  for (let day = 1; day <= remainingDays; day++) {
    const date = new Date(year, month + 1, day);
    days.push({
      date,
      isCurrentMonth: false,
      isToday: isSameDay(date, today),
      isRestDay: REGULAR_CLOSED_DAYS.includes(date.getDay()),
      isSpecialDate: false
    });
  }

  return days;
}

export function BusinessCalendarModal({ open, onClose }: BusinessCalendarModalProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    const days = generateCalendarDays(currentDate.getFullYear(), currentDate.getMonth());
    setCalendarDays(days);
  }, [currentDate]);

  const goToPreviousMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  if (!open) return null;

  const currentMonthName = MONTHS[currentDate.getMonth()];
  const currentYear = currentDate.getFullYear();

  return (
    <>
      {/* Backdrop */}
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />

      {/* Modal */}
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="calendar-modal-title">
        <div className={styles.modalContent}>
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.headerTop}>
              <h2 id="calendar-modal-title" className={styles.title}>
                營業行事曆
              </h2>
              <button className={styles.closeButton} onClick={onClose} aria-label="關閉">
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

            {/* Month Navigation */}
            <div className={styles.monthNav}>
              <button className={styles.navButton} onClick={goToPreviousMonth} aria-label="上個月">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M12 16l-6-6 6-6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              <div className={styles.currentMonth}>
                {currentYear} 年 {currentMonthName}
              </div>

              <button className={styles.navButton} onClick={goToNextMonth} aria-label="下個月">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M8 16l6-6-6-6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>

            <button className={styles.todayButton} onClick={goToToday}>
              回到今天
            </button>
          </div>

          {/* Calendar Grid */}
          <div className={styles.calendarWrapper}>
            {/* Weekday Headers */}
            <div className={styles.weekdayHeader}>
              {WEEKDAYS.map(day => (
                <div key={day} className={styles.weekdayLabel}>
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className={styles.calendarGrid}>
              {calendarDays.map((day, index) => (
                <div
                  key={index}
                  className={`
                    ${styles.dayCell}
                    ${!day.isCurrentMonth ? styles.otherMonth : ''}
                    ${day.isToday ? styles.today : ''}
                    ${day.isRestDay ? styles.restDay : ''}
                    ${day.isSpecialDate ? styles.specialDay : ''}
                  `}
                >
                  <div className={styles.dayNumber}>{day.date.getDate()}</div>
                  {day.isRestDay && day.isCurrentMonth && (
                    <div className={styles.restBadge}>休</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className={styles.legend}>
            <div className={styles.legendItem}>
              <div className={`${styles.legendDot} ${styles.legendToday}`} />
              <span>今天</span>
            </div>
            <div className={styles.legendItem}>
              <div className={`${styles.legendDot} ${styles.legendRest}`} />
              <span>固定公休（週一、週四）</span>
            </div>
          </div>

          {/* Info Section */}
          <div className={styles.infoSection}>
            <h3 className={styles.infoTitle}>營業時間說明</h3>
            <ul className={styles.infoList}>
              <li>當日訂單：上午 7:30 - 10:00</li>
              <li>隔日預訂：下午 2:00 - 晚上 12:00</li>
              <li>固定公休：每週一、週四</li>
              <li>特殊假期將另行公告於此行事曆</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
