import { describe, expect, it, vi } from 'vitest';
import { DriverService } from '../src/domain/driver-service';

const repository = {
  list: vi.fn(async () => []),
  listAvailableOrders: vi.fn(async () => []),
  updateStatus: vi.fn(async (id, status) => ({ id, status })),
  updateLocation: vi.fn(async (id, lat, lng) => ({ id, currentLat: lat, currentLng: lng }))
};

describe('DriverService', () => {
  const service = new DriverService(repository as any);

  it('validates driver location', async () => {
    await expect(service.updateLocation({ driverId: 'not-uuid', lat: 0, lng: 0 })).rejects.toThrow();
  });

  it('updates driver status', async () => {
    const result = await service.updateStatus({ driverId: '123e4567-e89b-12d3-a456-426614174000', status: 'available' });
    expect(result.status).toBe('available');
  });
});
