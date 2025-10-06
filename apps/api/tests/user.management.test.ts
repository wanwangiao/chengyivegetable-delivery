import { describe, expect, it, vi, beforeEach } from 'vitest';
import { UserManagementService } from '../src/domain/user-management-service';

const mockRepository = {
  findByEmail: vi.fn(async () => null),
  create: vi.fn(async input => ({
    id: 'user_123',
    email: input.email,
    password: input.password,
    name: input.name,
    role: input.role,
    isActive: input.isActive ?? true,
    createdAt: new Date(),
    updatedAt: new Date()
  })),
  list: vi.fn(async () => []),
  update: vi.fn(async (id, data) => ({
    id,
    email: 'existing@chengyi.tw',
    password: 'hashed',
    name: data.name ?? '現有使用者',
    role: (data.role as any) ?? 'CUSTOMER',
    isActive: (data.isActive as boolean | undefined) ?? true,
    createdAt: new Date(),
    updatedAt: new Date()
  })),
  findById: vi.fn(async () => null)
};

describe('UserManagementService', () => {
  const mockDriverRepo = {
    ensureProfile: vi.fn(async () => ({}))
  };
  const service = new UserManagementService(mockRepository as any, mockDriverRepo as any);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates user and hashes password', async () => {
    const result = await service.create({
      email: 'new@chengyi.tw',
      name: '新使用者',
      password: 'Password123',
      role: 'ADMIN'
    });

    expect(result.email).toBe('new@chengyi.tw');
    expect(mockRepository.create).toHaveBeenCalled();
    const createArgs = mockRepository.create.mock.calls[0][0];
    expect(createArgs.password).not.toBe('Password123');
    expect(typeof createArgs.password).toBe('string');
  });

  it('updates user role and toggles active flag', async () => {
    await service.update('user_123', { role: 'DRIVER', isActive: false });
    expect(mockRepository.update).toHaveBeenCalledWith('user_123', expect.objectContaining({
      role: 'DRIVER',
      isActive: false
    }));
    expect(mockDriverRepo.ensureProfile).toHaveBeenCalled();
  });
});
