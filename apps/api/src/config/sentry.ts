import * as Sentry from '@sentry/node';
import { env } from './env';

export function initSentry() {
  const SENTRY_DSN = process.env.SENTRY_DSN;

  if (!SENTRY_DSN) {
    console.warn('SENTRY_DSN not configured. Error monitoring will be disabled.');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: env.NODE_ENV,

    // 設定取樣率
    tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // 設定釋出版本
    release: process.env.RAILWAY_GIT_COMMIT_SHA || 'development',

    // Node.js 整合
    integrations: [
      Sentry.httpIntegration(),
      Sentry.prismaIntegration()
    ],

    // 過濾敏感資訊
    beforeSend(event) {
      // 移除敏感 headers
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }

      // 移除敏感查詢參數
      if (event.request?.query_string) {
        const params = new URLSearchParams(event.request.query_string);
        if (params.has('token')) params.delete('token');
        if (params.has('password')) params.delete('password');
        event.request.query_string = params.toString();
      }

      return event;
    },

    // 忽略特定錯誤
    ignoreErrors: [
      // 網路錯誤
      'Network request failed',
      'NetworkError',
      // 使用者取消請求
      'AbortError',
      'Request aborted',
      // 資源載入錯誤
      'ChunkLoadError',
      'Loading chunk',
      // 已知的良性錯誤
      'ResizeObserver loop',
      'Non-Error promise rejection captured'
    ]
  });

  console.log(`Sentry initialized (environment: ${env.NODE_ENV})`);
}

export { Sentry };
