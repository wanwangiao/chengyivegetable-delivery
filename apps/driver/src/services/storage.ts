// Web-only storage service using localStorage

const memoryStore: Record<string, string> = {};

const hasWindowStorage =
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export async function getItem(key: string): Promise<string | null> {
  if (hasWindowStorage) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      console.error('讀取 localStorage 失敗:', error);
    }
  }

  return memoryStore[key] ?? null;
}

export async function setItem(key: string, value: string): Promise<void> {
  if (hasWindowStorage) {
    try {
      window.localStorage.setItem(key, value);
      return;
    } catch (error) {
      console.error('寫入 localStorage 失敗:', error);
    }
  }

  memoryStore[key] = value;
}

export async function removeItem(key: string): Promise<void> {
  if (hasWindowStorage) {
    try {
      window.localStorage.removeItem(key);
      return;
    } catch (error) {
      console.error('移除 localStorage 失敗:', error);
    }
  }

  delete memoryStore[key];
}
