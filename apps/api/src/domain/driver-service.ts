import { z } from 'zod';
import type { DriverRepository } from '../infrastructure/prisma/driver.repository';

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
  constructor(private readonly repository: DriverRepository) {}

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
