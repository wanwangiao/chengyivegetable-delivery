import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';

/**
 * 台灣時區常數
 */
export const TAIWAN_TIMEZONE = 'Asia/Taipei';

/**
 * 取得當前台灣時間
 * 即使系統使用 UTC，也會返回正確的台灣時間
 */
export function getTaiwanTime(date?: Date): Date {
  const sourceDate = date ?? new Date();
  return utcToZonedTime(sourceDate, TAIWAN_TIMEZONE);
}

/**
 * 將台灣時間轉換為 UTC 時間
 */
export function taiwanTimeToUtc(taiwanDate: Date): Date {
  return zonedTimeToUtc(taiwanDate, TAIWAN_TIMEZONE);
}

/**
 * 取得當前台灣時間的小時數 (0-23)
 */
export function getTaiwanHours(date?: Date): number {
  const taiwanTime = getTaiwanTime(date);
  return taiwanTime.getHours();
}

/**
 * 取得當前台灣時間的分鐘數 (0-59)
 */
export function getTaiwanMinutes(date?: Date): number {
  const taiwanTime = getTaiwanTime(date);
  return taiwanTime.getMinutes();
}

/**
 * 取得當前台灣時間的星期幾 (0=Sunday, 1=Monday, ..., 6=Saturday)
 */
export function getTaiwanDayOfWeek(date?: Date): number {
  const taiwanTime = getTaiwanTime(date);
  return taiwanTime.getDay();
}

/**
 * 取得台灣時間的分鐘總數（從午夜 00:00 開始）
 */
export function getTaiwanTimeInMinutes(date?: Date): number {
  const taiwanTime = getTaiwanTime(date);
  return taiwanTime.getHours() * 60 + taiwanTime.getMinutes();
}
