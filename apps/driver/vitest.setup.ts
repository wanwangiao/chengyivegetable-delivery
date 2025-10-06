import { afterEach, beforeAll, vi } from 'vitest';

beforeAll(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({})
    }))
  );
});

afterEach(() => {
  vi.clearAllMocks();
});
