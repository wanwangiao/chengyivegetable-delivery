import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { UserRepository, UserSummary } from '../infrastructure/prisma/user.repository';
import { prismaDriverRepository } from '../infrastructure/prisma/driver.repository';

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
  role: z.enum(['ADMIN', 'DRIVER', 'CUSTOMER'])
});

const updateUserSchema = z
  .object({
    name: z.string().min(1).optional(),
    role: z.enum(['ADMIN', 'DRIVER', 'CUSTOMER']).optional(),
    isActive: z.boolean().optional(),
    password: z.string().min(8).optional()
  })
  .refine(data => Object.keys(data).length > 0, {
    message: 'EMPTY_PAYLOAD'
  });

export class UserManagementService {
  constructor(
    private readonly repository: UserRepository,
    private readonly driverRepository = prismaDriverRepository
  ) {}

  async list(): Promise<UserSummary[]> {
    return await this.repository.list();
  }

  async create(input: unknown) {
    const parsed = createUserSchema.parse(input);
    const existing = await this.repository.findByEmail(parsed.email);
    if (existing) {
      throw new Error('EMAIL_EXISTS');
    }

    const hashed = await bcrypt.hash(parsed.password, 10);
    const user = await this.repository.create({
      email: parsed.email,
      password: hashed,
      name: parsed.name,
      role: parsed.role,
      isActive: true
    });

    if (parsed.role === 'DRIVER') {
      await this.driverRepository.ensureProfile(user.id, parsed.name);
    }

    return this.toSafeUser(user);
  }

  async update(userId: string, input: unknown) {
    const parsed = updateUserSchema.parse(input);
    const data: any = {};

    if (parsed.name !== undefined) data.name = parsed.name;
    if (parsed.role !== undefined) data.role = parsed.role;
    if (parsed.isActive !== undefined) data.isActive = parsed.isActive;
    if (parsed.password) {
      data.password = await bcrypt.hash(parsed.password, 10);
    }

    const user = await this.repository.update(userId, data);

    if (parsed.role === 'DRIVER' || user.role === 'DRIVER') {
      await this.driverRepository.ensureProfile(user.id, parsed.name ?? user.name);
    }

    return this.toSafeUser(user);
  }

  async delete(userId: string): Promise<void> {
    const user = await this.repository.findById(userId);
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    // 如果是司機，同時刪除司機檔案
    if (user.role === 'DRIVER') {
      await this.driverRepository.deleteProfile(userId);
    }

    await this.repository.delete(userId);
  }

  private toSafeUser(user: { id: string; email: string; name: string; role: string; isActive: boolean; createdAt: Date }) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt
    };
  }
}
