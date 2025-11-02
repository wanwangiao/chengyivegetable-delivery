/**
 * API 配置
 *
 * 自動偵測環境並使用正確的 API URL：
 * - 優先使用環境變數 NEXT_PUBLIC_API_BASE
 * - Railway 生產環境自動使用生產 API URL
 * - 本地開發使用 localhost
 */

const getApiBaseUrl = (): string => {
  // 1. 優先使用環境變數（允許手動覆蓋）
  if (process.env.NEXT_PUBLIC_API_BASE) {
    return process.env.NEXT_PUBLIC_API_BASE;
  }

  // 2. 在瀏覽器環境檢測 Railway 部署
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;

    // Railway 生產環境
    if (hostname.includes('railway.app')) {
      return 'https://chengyivegetable-api-production.up.railway.app/api/v1';
    }
  }

  // 3. 在伺服器端檢測 Railway 環境變數
  if (process.env.RAILWAY_ENVIRONMENT) {
    return 'https://chengyivegetable-api-production.up.railway.app/api/v1';
  }

  // 4. 默認使用本地開發環境
  return 'http://localhost:3000/api/v1';
};

export const API_BASE_URL = getApiBaseUrl();

// 導出給其他可能需要的配置
export const config = {
  apiBaseUrl: API_BASE_URL,
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
} as const;
