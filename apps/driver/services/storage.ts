import { Platform } from 'react-native';

const memoryStore: Record<string, string> = {};
const isWeb = Platform.OS === 'web';

const hasWindowStorage =
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

type AsyncStorageModule = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

let asyncStorage: AsyncStorageModule | null = null;
try {
  const module = require('@react-native-async-storage/async-storage');
  asyncStorage = module?.default ?? module;
} catch {
  asyncStorage = null;
}

const asyncStorageAvailable =
  asyncStorage !== null &&
  typeof asyncStorage.getItem === 'function';

export async function getItem(key: string): Promise<string | null> {
  if (isWeb && hasWindowStorage) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      console.error('讀取 localStorage 失敗:', error);
    }
  }

  if (asyncStorageAvailable && asyncStorage) {
    try {
      return await asyncStorage.getItem(key);
    } catch (error) {
      console.error('讀取 AsyncStorage 失敗:', error);
    }
  }

  return memoryStore[key] ?? null;
}

export async function setItem(key: string, value: string): Promise<void> {
  if (isWeb && hasWindowStorage) {
    try {
      window.localStorage.setItem(key, value);
      return;
    } catch (error) {
      console.error('寫入 localStorage 失敗:', error);
    }
  }

  if (asyncStorageAvailable && asyncStorage) {
    try {
      await asyncStorage.setItem(key, value);
      return;
    } catch (error) {
      console.error('寫入 AsyncStorage 失敗:', error);
    }
  }

  memoryStore[key] = value;
}

export async function removeItem(key: string): Promise<void> {
  if (isWeb && hasWindowStorage) {
    try {
      window.localStorage.removeItem(key);
      return;
    } catch (error) {
      console.error('移除 localStorage 失敗:', error);
    }
  }

  if (asyncStorageAvailable && asyncStorage) {
    try {
      await asyncStorage.removeItem(key);
      return;
    } catch (error) {
      console.error('移除 AsyncStorage 失敗:', error);
    }
  }

  delete memoryStore[key];
}
