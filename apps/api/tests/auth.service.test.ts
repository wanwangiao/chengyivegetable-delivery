import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../src/domain/auth-service';

const mockRepo = {
  findByEmail: vi.fn(async () => null),
  create: vi.fn(async (input) => ({ id: 'user_1', ...input }))
};

describe('AuthService', () => {
  const service = new AuthService(mockRepo as any);

  it('rejects duplicate email on register', async () => {
    mockRepo.findByEmail.mockResolvedValueOnce({ id: 'existing', email: 'test@example.com', password: 'hash', role: 'ADMIN', name: 'admin' });
    await expect(service.register({ email: 'test@example.com', password: 'Password1', name: 'Admin', role: 'ADMIN' })).rejects.toThrow('EMAIL_EXISTS');
  });
});
