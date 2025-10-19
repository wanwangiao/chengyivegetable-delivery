import { getItem, removeItem, setItem } from './storage';

const TOKEN_STORAGE_KEY = 'chengyi_driver_token';

export async function loadToken(): Promise<string | null> {
  return await getItem(TOKEN_STORAGE_KEY);
}

export async function persistToken(token: string): Promise<void> {
  await setItem(TOKEN_STORAGE_KEY, token);
}

export async function clearToken(): Promise<void> {
  await removeItem(TOKEN_STORAGE_KEY);
}

export { TOKEN_STORAGE_KEY };
