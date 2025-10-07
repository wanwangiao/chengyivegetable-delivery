import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { env } from './env';

const resolveRoot = () => {
  const configured = env.FILE_STORAGE_PATH?.trim();
  if (configured) {
    return configured;
  }

  return join(process.cwd(), 'uploads');
};

const root = resolveRoot();

try {
  mkdirSync(root, { recursive: true });
} catch {
  // directory creation best-effort; write operations will surface errors if any
}

export const storageConfig = {
  root,
  resolve: (...segments: string[]) => join(root, ...segments)
};
