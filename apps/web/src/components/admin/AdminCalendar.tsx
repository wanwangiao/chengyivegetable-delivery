'use client';

import { useEffect, useState } from 'react';
import styles from './AdminCalendar.module.css';

interface SpecialDate {
  id?: string;
  date: Date;
  type: 'CLOSED' | 'OPEN';
  reason: string;
}

interface BusinessHours {
  regularClosedDays: number[]; // [1, 4] for Monday, Thursday
  orderCutoffTime: string; // "10:00"
  preorderStartTime: string; // "14:00"
  currentOrderStartTime: string; // "07:30"
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isRegularRestDay: boolean;
  specialDate?: SpecialDate;
}

const MONTHS = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

function generateCalendarDays(
  year: number,
  month: number,
  regularClosedDays: number[],
  specialDates: SpecialDate[]
): CalendarDay[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days: CalendarDay[] = [];

  // Add days from previous month
  const firstDayOfWeek = firstDay.getDay();
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const date = new Date(year, month, -i);
    const special = specialDates.find(sd => isSameDay(new Date(sd.date), date));
    days.push({
      date,
      isCurrentMonth: false,
      isToday: isSameDay(date, today),
      isRegularRestDay: regularClosedDays.includes(date.getDay()),
      specialDate: special
    });
  }

  // Add days from current month
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(year, month, day);
    const special = specialDates.find(sd => isSameDay(new Date(sd.date), date));
    days.push({
      date,
      isCurrentMonth: true,
      isToday: isSameDay(date, today),
      isRegularRestDay: regularClosedDays.includes(date.getDay()),
      specialDate: special
    });
  }

  // Add days from next month
  const remainingDays = 42 - days.length;
  for (let day = 1; day <= remainingDays; day++) {
    const date = new Date(year, month + 1, day);
    const special = specialDates.find(sd => isSameDay(new Date(sd.date), date));
    days.push({
      date,
      isCurrentMonth: false,
      isToday: isSameDay(date, today),
      isRegularRestDay: regularClosedDays.includes(date.getDay()),
      specialDate: special
    });
  }

  return days;
}

export function AdminCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [showDateModal, setShowDateModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Mock data - 實際應該從 API 取得
  const [businessHours, setBusinessHours] = useState<BusinessHours>({
    regularClosedDays: [1, 4], // Monday, Thursday
    orderCutoffTime: '10:00',
    preorderStartTime: '14:00',
    currentOrderStartTime: '07:30'
  });

  const [specialDates, setSpecialDates] = useState<SpecialDate[]>([
    // Mock data - 實際應該從 API 取得
  ]);

  useEffect(() => {
    const days = generateCalendarDays(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      businessHours.regularClosedDays,
      specialDates
    );
    setCalendarDays(days);
  }, [currentDate, businessHours.regularClosedDays, specialDates]);

  const goToPreviousMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleDayClick = (day: CalendarDay) => {
    if (day.isCurrentMonth) {
      setSelectedDay(day);
      setShowDateModal(true);
    }
  };

  const handleAddSpecialDate = (type: 'CLOSED' | 'OPEN', reason: string) => {
    if (!selectedDay) return;

    const newSpecialDate: SpecialDate = {
      id: `temp-${Date.now()}`,
      date: selectedDay.date,
      type,
      reason
    };

    setSpecialDates(prev => [...prev, newSpecialDate]);
    setShowDateModal(false);
    setSelectedDay(null);
  };

  const handleRemoveSpecialDate = (dateToRemove: Date) => {
    setSpecialDates(prev =>
      prev.filter(sd => !isSameDay(new Date(sd.date), dateToRemove))
    );
    setShowDateModal(false);
    setSelectedDay(null);
  };

  const getDayStatus = (day: CalendarDay): 'open' | 'closed' | 'special-open' | 'special-closed' => {
    if (day.specialDate) {
      return day.specialDate.type === 'OPEN' ? 'special-open' : 'special-closed';
    }
    return day.isRegularRestDay ? 'closed' : 'open';
  };

  const currentMonthName = MONTHS[currentDate.getMonth()];
  const currentYear = currentDate.getFullYear();

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>營業行事曆管理</h1>
        <button
          className={styles.settingsButton}
          onClick={() => setShowSettingsModal(true)}
          type="button"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M16.5 10c0 .5-.1 1-.2 1.4l1.4.8c.2.1.2.3.1.5l-1.3 2.3c-.1.2-.3.2-.5.1l-1.4-.8c-.6.5-1.3.9-2.1 1.1v1.6c0 .2-.2.4-.4.4h-2.6c-.2 0-.4-.2-.4-.4v-1.6c-.8-.2-1.5-.6-2.1-1.1l-1.4.8c-.2.1-.4 0-.5-.1l-1.3-2.3c-.1-.2 0-.4.1-.5l1.4-.8c-.1-.4-.2-.9-.2-1.4s.1-1 .2-1.4l-1.4-.8c-.2-.1-.2-.3-.1-.5l1.3-2.3c.1-.2.3-.2.5-.1l1.4.8c.6-.5 1.3-.9 2.1-1.1V2.4c0-.2.2-.4.4-.4h2.6c.2 0 .4.2.4.4v1.6c.8.2 1.5.6 2.1 1.1l1.4-.8c.2-.1.4 0 .5.1l1.3 2.3c.1.2 0 .4-.1.5l-1.4.8c.1.4.2.9.2 1.4z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          營業時間設定
        </button>
      </div>

      {/* Calendar Navigation */}
      <div className={styles.calendarCard}>
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

        {/* Weekday Headers */}
        <div className={styles.weekdayHeader}>
          {WEEKDAYS.map(day => (
            <div key={day} className={styles.weekdayLabel}>
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className={styles.calendarGrid}>
          {calendarDays.map((day, index) => {
            const status = getDayStatus(day);
            return (
              <button
                key={index}
                className={`
                  ${styles.dayCell}
                  ${!day.isCurrentMonth ? styles.otherMonth : ''}
                  ${day.isToday ? styles.today : ''}
                  ${styles[status]}
                `}
                onClick={() => handleDayClick(day)}
                type="button"
                disabled={!day.isCurrentMonth}
              >
                <div className={styles.dayNumber}>{day.date.getDate()}</div>
                {status === 'closed' && day.isCurrentMonth && (
                  <div className={styles.statusBadge}>休</div>
                )}
                {status === 'special-closed' && day.isCurrentMonth && (
                  <div className={`${styles.statusBadge} ${styles.special}`}>
                    特休
                  </div>
                )}
                {status === 'special-open' && day.isCurrentMonth && (
                  <div className={`${styles.statusBadge} ${styles.specialOpen}`}>
                    營業
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className={styles.legend}>
          <div className={styles.legendItem}>
            <div className={`${styles.legendDot} ${styles.legendOpen}`} />
            <span>營業日</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendDot} ${styles.legendClosed}`} />
            <span>固定公休</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendDot} ${styles.legendSpecialClosed}`} />
            <span>特殊休假</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendDot} ${styles.legendSpecialOpen}`} />
            <span>臨時營業</span>
          </div>
        </div>
      </div>

      {/* Special Dates List */}
      <div className={styles.specialDatesCard}>
        <h2 className={styles.cardTitle}>特殊日期設定</h2>
        {specialDates.length === 0 ? (
          <p className={styles.emptyState}>尚無設定特殊日期</p>
        ) : (
          <ul className={styles.specialDatesList}>
            {specialDates
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
              .map((sd, index) => (
                <li key={index} className={styles.specialDateItem}>
                  <div className={styles.specialDateInfo}>
                    <div className={`${styles.specialDateType} ${sd.type === 'CLOSED' ? styles.typeClosed : styles.typeOpen}`}>
                      {sd.type === 'CLOSED' ? '休假' : '營業'}
                    </div>
                    <div className={styles.specialDateDetails}>
                      <div className={styles.specialDateDate}>
                        {new Date(sd.date).toLocaleDateString('zh-TW', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          weekday: 'short'
                        })}
                      </div>
                      <div className={styles.specialDateReason}>{sd.reason}</div>
                    </div>
                  </div>
                  <button
                    className={styles.deleteButton}
                    onClick={() => handleRemoveSpecialDate(new Date(sd.date))}
                    aria-label="刪除"
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path
                        d="M6 6l8 8M14 6l-8 8"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </li>
              ))}
          </ul>
        )}
      </div>

      {/* Date Modal */}
      {showDateModal && selectedDay && (
        <DateModal
          day={selectedDay}
          onClose={() => {
            setShowDateModal(false);
            setSelectedDay(null);
          }}
          onAddSpecialDate={handleAddSpecialDate}
          onRemoveSpecialDate={handleRemoveSpecialDate}
        />
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <SettingsModal
          businessHours={businessHours}
          onClose={() => setShowSettingsModal(false)}
          onSave={(newSettings) => {
            setBusinessHours(newSettings);
            setShowSettingsModal(false);
          }}
        />
      )}
    </div>
  );
}

// Date Modal Component
function DateModal({
  day,
  onClose,
  onAddSpecialDate,
  onRemoveSpecialDate
}: {
  day: CalendarDay;
  onClose: () => void;
  onAddSpecialDate: (type: 'CLOSED' | 'OPEN', reason: string) => void;
  onRemoveSpecialDate: (date: Date) => void;
}) {
  const [dateType, setDateType] = useState<'CLOSED' | 'OPEN'>('CLOSED');
  const [reason, setReason] = useState('');

  const handleSubmit = () => {
    if (reason.trim()) {
      onAddSpecialDate(dateType, reason);
    }
  };

  return (
    <>
      <div className={styles.modalBackdrop} onClick={onClose} />
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>
            {day.date.toLocaleDateString('zh-TW', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'short'
            })}
          </h3>
          <button className={styles.modalCloseButton} onClick={onClose}>
            ×
          </button>
        </div>

        <div className={styles.modalBody}>
          {day.specialDate ? (
            <div className={styles.existingSpecialDate}>
              <p>
                <strong>目前設定：</strong>
                {day.specialDate.type === 'CLOSED' ? '特殊休假' : '臨時營業'}
              </p>
              <p>
                <strong>原因：</strong>
                {day.specialDate.reason}
              </p>
              <button
                className={styles.removeButton}
                onClick={() => onRemoveSpecialDate(day.date)}
              >
                移除此設定
              </button>
            </div>
          ) : (
            <>
              <div className={styles.formGroup}>
                <label className={styles.label}>類型</label>
                <div className={styles.radioGroup}>
                  <label className={styles.radioLabel}>
                    <input
                      type="radio"
                      value="CLOSED"
                      checked={dateType === 'CLOSED'}
                      onChange={() => setDateType('CLOSED')}
                    />
                    <span>特殊休假</span>
                  </label>
                  <label className={styles.radioLabel}>
                    <input
                      type="radio"
                      value="OPEN"
                      checked={dateType === 'OPEN'}
                      onChange={() => setDateType('OPEN')}
                    />
                    <span>臨時營業（覆蓋固定公休）</span>
                  </label>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="reason">
                  原因說明
                </label>
                <input
                  id="reason"
                  type="text"
                  className={styles.input}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="例如：春節連假、颱風假、臨時加班..."
                />
              </div>

              <button
                className={styles.submitButton}
                onClick={handleSubmit}
                disabled={!reason.trim()}
              >
                儲存設定
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// Settings Modal Component
function SettingsModal({
  businessHours,
  onClose,
  onSave
}: {
  businessHours: BusinessHours;
  onClose: () => void;
  onSave: (settings: BusinessHours) => void;
}) {
  const [settings, setSettings] = useState(businessHours);
  const [selectedDays, setSelectedDays] = useState<number[]>(businessHours.regularClosedDays);

  const weekdayOptions = [
    { value: 0, label: '週日' },
    { value: 1, label: '週一' },
    { value: 2, label: '週二' },
    { value: 3, label: '週三' },
    { value: 4, label: '週四' },
    { value: 5, label: '週五' },
    { value: 6, label: '週六' }
  ];

  const toggleDay = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleSave = () => {
    onSave({
      ...settings,
      regularClosedDays: selectedDays
    });
  };

  return (
    <>
      <div className={styles.modalBackdrop} onClick={onClose} />
      <div className={`${styles.modal} ${styles.settingsModal}`}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>營業時間設定</h3>
          <button className={styles.modalCloseButton} onClick={onClose}>
            ×
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.formGroup}>
            <label className={styles.label}>固定公休日</label>
            <div className={styles.dayCheckboxGroup}>
              {weekdayOptions.map(({ value, label }) => (
                <label key={value} className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={selectedDays.includes(value)}
                    onChange={() => toggleDay(value)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="currentOrderStart">
              當日訂單開放時間
            </label>
            <input
              id="currentOrderStart"
              type="time"
              className={styles.input}
              value={settings.currentOrderStartTime}
              onChange={(e) =>
                setSettings({ ...settings, currentOrderStartTime: e.target.value })
              }
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="orderCutoff">
              當日訂單截止時間
            </label>
            <input
              id="orderCutoff"
              type="time"
              className={styles.input}
              value={settings.orderCutoffTime}
              onChange={(e) =>
                setSettings({ ...settings, orderCutoffTime: e.target.value })
              }
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="preorderStart">
              隔日預訂開放時間
            </label>
            <input
              id="preorderStart"
              type="time"
              className={styles.input}
              value={settings.preorderStartTime}
              onChange={(e) =>
                setSettings({ ...settings, preorderStartTime: e.target.value })
              }
            />
          </div>

          <button className={styles.submitButton} onClick={handleSave}>
            儲存設定
          </button>
        </div>
      </div>
    </>
  );
}
