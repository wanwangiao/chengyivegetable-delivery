import { prisma } from './client';
import type { OrderStatus } from '@chengyi/domain';

export interface Driver {
  id: string;
  name: string;
  phone: string;
  status: string;
  currentLat?: number;
  currentLng?: number;
  lastLocationUpdate?: Date;
}

export const driverStatus = {
  OFFLINE: 'offline',
  AVAILABLE: 'available',
  BUSY: 'busy'
} as const;

export interface DriverRepository {
  findById(id: string): Promise<Driver | null>;
  list(): Promise<Driver[]>;
  updateStatus(driverId: string, status: string): Promise<Driver>;
  updateLocation(driverId: string, lat: number, lng: number): Promise<Driver>;
  listAvailableOrders(): Promise<Array<{ id: string; address: string; contactName: string; totalAmount: number; status: OrderStatus }>>;
  listWithStats(): Promise<Array<{ driver: Driver; activeOrders: number; lastOrderAt: Date | null }>>;
  ensureProfile(driverId: string, name: string, phone?: string): Promise<Driver>;
}

const mapDriver = (driver: any): Driver => ({
  id: driver.id,
  name: driver.name,
  phone: driver.phone,
  status: driver.status,
  currentLat: driver.currentLat ?? undefined,
  currentLng: driver.currentLng ?? undefined,
  lastLocationUpdate: driver.lastLocationUpdate ?? undefined
});

export const prismaDriverRepository: DriverRepository = {
  async findById(id) {
    const driver = await prisma.driver.findUnique({ where: { id } });
    return driver ? mapDriver(driver) : null;
  },

  async list() {
    const drivers = await prisma.driver.findMany({ orderBy: { name: 'asc' } });
    return drivers.map(mapDriver);
  },

  async listWithStats() {
    const drivers = await prisma.driver.findMany({
      include: {
        orders: {
          select: {
            id: true,
            status: true,
            updatedAt: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    return drivers.map(driver => {
      const mapped = mapDriver(driver);
      const activeOrders = driver.orders.filter(order => ['delivering', 'ready'].includes(order.status)).length;
      const lastOrderAt = driver.orders.reduce<Date | null>((latest, order) => {
        const date = order.updatedAt;
        if (!latest || date > latest) {
          return date;
        }
        return latest;
      }, null);

      return {
        driver: mapped,
        activeOrders,
        lastOrderAt
      };
    });
  },

  async updateStatus(driverId, status) {
    const driver = await prisma.driver.update({
      where: { id: driverId },
      data: { status }
    });
    return mapDriver(driver);
  },

  async updateLocation(driverId, lat, lng) {
    const driver = await prisma.driver.update({
      where: { id: driverId },
      data: {
        currentLat: lat,
        currentLng: lng,
        lastLocationUpdate: new Date()
      }
    });
    return mapDriver(driver);
  },

  async listAvailableOrders() {
    const orders = await prisma.order.findMany({
      where: { status: 'ready' },
      select: {
        id: true,
        address: true,
        contactName: true,
        totalAmount: true,
        status: true
      },
      orderBy: { createdAt: 'asc' }
    });

    return orders.map(order => ({
      id: order.id,
      address: order.address,
      contactName: order.contactName,
      totalAmount: Number(order.totalAmount),
      status: order.status as OrderStatus
    }));
  },

  async ensureProfile(driverId, name, phone) {
    const driver = await prisma.driver.upsert({
      where: { id: driverId },
      update: {
        name,
        phone: phone ?? '未設定',
        status: driverStatus.AVAILABLE
      },
      create: {
        id: driverId,
        name,
        phone: phone ?? '未設定',
        status: driverStatus.AVAILABLE
      }
    });
    return mapDriver(driver);
  }
};
