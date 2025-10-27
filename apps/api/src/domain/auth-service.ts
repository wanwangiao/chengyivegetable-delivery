import bcrypt from 'bcryptjs';
import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';
import { z } from 'zod';
import type { UserRepository } from '../infrastructure/prisma/user.repository';
import { env } from '../config/env';

const registerSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(['ADMIN', 'DRIVER', 'CUSTOMER'])
});

const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(8)
});

export class AuthService {
  constructor(private readonly userRepository: UserRepository) {}

  async register(input: unknown) {
    const parsed = registerSchema.parse(input);
    const existing = await this.userRepository.findByEmail(parsed.email);
    if (existing) {
      throw new Error('EMAIL_EXISTS');
    }

    const hashed = await bcrypt.hash(parsed.password, 10);
    const user = await this.userRepository.create({
      email: parsed.email,
      password: hashed,
      name: parsed.name,
      role: parsed.role,
      isActive: true
    });

    return this.generateTokens(user.id, user.role);
  }

  async login(input: unknown) {
    const parsed = loginSchema.parse(input);
    const user = await this.userRepository.findByEmail(parsed.email);
    if (!user || !user.isActive) {
      throw new Error('INVALID_CREDENTIALS');
    }

    const match = await bcrypt.compare(parsed.password, user.password);
    if (!match) {
      throw new Error('INVALID_CREDENTIALS');
    }

    return this.generateTokens(user.id, user.role);
  }

  generateTokens(userId: string, role: string) {
    const secret = env.JWT_SECRET as Secret;
    const options: SignOptions = {
      expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn']
    };
    const accessToken = jwt.sign({ sub: userId, role }, secret, options);

    return {
      accessToken,
      tokenType: 'Bearer'
    };
  }

  verify(token: string) {
    return jwt.verify(token, env.JWT_SECRET) as { sub: string; role: string };
  }
}
