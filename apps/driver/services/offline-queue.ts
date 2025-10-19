import { removeItem, setItem, getItem } from './storage';

const QUEUE_STORAGE_KEY = 'chengyi_offline_queue';
const MAX_QUEUE_SIZE = 100;
const MAX_RETRY_COUNT = 3;

export interface QueuedRequest {
  id: string;
  url: string;
  method: string;
  body?: any;
  headers?: Record<string, string>;
  timestamp: number;
  retryCount: number;
}

export class OfflineQueueService {
  private queue: QueuedRequest[] = [];
  private isProcessing = false;
  private onlineCallback?: () => void;

  constructor() {
    void this.loadQueue();
    this.setupOnlineListener();
  }

  /**
   * 載入儲存的佇列
   */
  private async loadQueue(): Promise<void> {
    try {
      const stored = await getItem(QUEUE_STORAGE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
      }
    } catch (error) {
      console.error('載入離線佇列失敗:', error);
      this.queue = [];
    }
  }

  /**
   * 儲存佇列到 localStorage
   */
  private async saveQueue(): Promise<void> {
    try {
      if (this.queue.length === 0) {
        await removeItem(QUEUE_STORAGE_KEY);
      } else {
        await setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
      }
    } catch (error) {
      console.error('儲存離線佇列失敗:', error);
    }
  }

  /**
   * 監聽網路恢復事件
   */
  private setupOnlineListener(): void {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
      return;
    }

    window.addEventListener('online', () => {
      console.log('網路已恢復，開始處理離線佇列');
      void this.processQueue();
      if (this.onlineCallback) {
        this.onlineCallback();
      }
    });
  }

  /**
   * 設定網路恢復回調
   */
  public setOnlineCallback(callback: () => void): void {
    this.onlineCallback = callback;
  }

  /**
   * 加入請求到佇列
   */
  public enqueue(request: Omit<QueuedRequest, 'id' | 'timestamp' | 'retryCount'>): void {
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      console.warn('離線佇列已滿，移除最舊的請求');
      this.queue.shift();
    }

    const queuedRequest: QueuedRequest = {
      ...request,
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
      retryCount: 0
    };

    this.queue.push(queuedRequest);
    void this.saveQueue();

    console.log(`請求已加入離線佇列: ${request.method} ${request.url}`);
  }

  /**
   * 處理佇列中的所有請求
   */
  public async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    this.isProcessing = true;
    console.log(`開始處理離線佇列，共 ${this.queue.length} 個請求`);

    const failedRequests: QueuedRequest[] = [];

    while (this.queue.length > 0) {
      const request = this.queue.shift()!;

      try {
        const response = await fetch(request.url, {
          method: request.method,
          headers: request.headers,
          body: request.body ? JSON.stringify(request.body) : undefined
        });

        if (response.ok) {
          console.log(`離線請求成功: ${request.method} ${request.url}`);
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        console.error(`離線請求失敗: ${request.method} ${request.url}`, error);

        if (request.retryCount < MAX_RETRY_COUNT) {
          failedRequests.push({
            ...request,
            retryCount: request.retryCount + 1
          });
        } else {
          console.warn(`請求已達最大重試次數，放棄: ${request.method} ${request.url}`);
        }
      }

      // 避免過快請求
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 將失敗的請求放回佇列
    this.queue = failedRequests;
    await this.saveQueue();

    this.isProcessing = false;
    console.log(`離線佇列處理完成，剩餘 ${this.queue.length} 個請求`);
  }

  /**
   * 取得佇列長度
   */
  public getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * 清空佇列
   */
  public clearQueue(): void {
    this.queue = [];
    void this.saveQueue();
    console.log('離線佇列已清空');
  }

  /**
   * 檢查是否有待處理的請求
   */
  public hasPendingRequests(): boolean {
    return this.queue.length > 0;
  }
}

// 單例模式
let instance: OfflineQueueService | null = null;

export function getOfflineQueueService(): OfflineQueueService {
  if (!instance) {
    instance = new OfflineQueueService();
  }
  return instance;
}
