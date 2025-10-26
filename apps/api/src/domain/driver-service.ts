import { z } from 'zod';
import bcrypt from 'bcryptjs';
import type { DriverRepository } from '../infrastructure/prisma/driver.repository';
import type { AuthService } from './auth-service';

const loginSchema = z.object({
  phone: z.string().min(1),
  password: z.string().min(1)
});

const updateStatusSchema = z.object({
  driverId: z.string().uuid(),
  status: z.enum(['offline', 'available', 'busy'])
});

const updateLocationSchema = z.object({
  driverId: z.string().uuid(),
  lat: z.number().refine(val => Math.abs(val) <= 90, 'Invalid latitude'),
  lng: z.number().refine(val => Math.abs(val) <= 180, 'Invalid longitude')
});

export class DriverService {
  constructor(
    private readonly repository: DriverRepository,
    private readonly authService: AuthService
  ) {}

  async login(input: unknown) {
    const parsed = loginSchema.parse(input);

    // Find driver by phone number
    const driver = await this.repository.findByPhone(parsed.phone);

    if (!driver || !driver.user) {
      throw new Error('INVALID_CREDENTIALS');
    }

    // Check if user is active and has DRIVER role
    if (!driver.user.isActive || driver.user.role !== 'DRIVER') {
      throw new Error('INVALID_CREDENTIALS');
    }

    // Verify password
    const match = await bcrypt.compare(parsed.password, driver.user.password);
    if (!match) {
      throw new Error('INVALID_CREDENTIALS');
    }

    // Generate JWT token using AuthService
    return this.authService.generateTokens(driver.user.id, driver.user.role);
  }

  async listDrivers() {
    return await this.repository.list();
  }

  async getProfile(driverId: string) {
    const driver = await this.repository.findById(driverId);
    if (!driver) {
      throw new Error('DRIVER_NOT_FOUND');
    }
    return driver;
  }

  async listDriverStats() {
    return await this.repository.listWithStats();
  }

  async listAvailableOrders() {
    return await this.repository.listAvailableOrders();
  }

  async updateStatus(input: unknown) {
    const parsed = updateStatusSchema.parse(input);
    return await this.repository.updateStatus(parsed.driverId, parsed.status);
  }

  async updateLocation(input: unknown) {
    const parsed = updateLocationSchema.parse(input);
    return await this.repository.updateLocation(parsed.driverId, parsed.lat, parsed.lng);
  }
}
