import type { Prisma, UserRole } from '@prisma/client';
import { prisma } from './client';

export interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserSummary {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
}

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  list(): Promise<UserSummary[]>;
  create(input: { email: string; password: string; name: string; role: UserRole; isActive?: boolean }): Promise<User>;
  update(id: string, data: Prisma.UserUpdateInput): Promise<User>;
}

const mapUser = (user: any): User => ({
  id: user.id,
  email: user.email,
  password: user.password,
  name: user.name,
  role: user.role,
  isActive: user.isActive,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});

const mapSummary = (user: any): UserSummary => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  isActive: user.isActive,
  createdAt: user.createdAt
});

export const prismaUserRepository: UserRepository = {
  async findByEmail(email) {
    const user = await prisma.user.findUnique({ where: { email } });
    return user ? mapUser(user) : null;
  },

  async findById(id) {
    const user = await prisma.user.findUnique({ where: { id } });
    return user ? mapUser(user) : null;
  },

  async list() {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return users.map(mapSummary);
  },

  async create(input) {
    const user = await prisma.user.create({
      data: input
    });
    return mapUser(user);
  },

  async update(id, data) {
    const user = await prisma.user.update({
      where: { id },
      data
    });
    return mapUser(user);
  }
};
