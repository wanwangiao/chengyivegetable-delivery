import { prisma } from './client';

export interface SystemConfigData {
  id: string;
  storeName: string;
  storeLogo: string | null;
  storePhone: string | null;
  currentOrderStartTime: string;
  currentOrderEndTime: string;
  preOrderStartTime: string;
  preOrderEndTime: string;
  priceChangeThreshold: number;
  priceConfirmTimeout: number;
  lineNotificationEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SystemConfigUpdateInput {
  storeName?: string;
  storeLogo?: string | null;
  storePhone?: string | null;
  currentOrderStartTime?: string;
  currentOrderEndTime?: string;
  preOrderStartTime?: string;
  preOrderEndTime?: string;
  priceChangeThreshold?: number;
  priceConfirmTimeout?: number;
  lineNotificationEnabled?: boolean;
}

export interface SystemConfigRepository {
  get(): Promise<SystemConfigData>;
  update(data: SystemConfigUpdateInput): Promise<SystemConfigData>;
  getOrCreate(): Promise<SystemConfigData>;
}

const DEFAULT_CONFIG: Omit<SystemConfigData, 'createdAt' | 'updatedAt'> = {
  id: 'system-config',
  storeName: '誠憶鮮蔬',
  storeLogo: null,
  storePhone: null,
  currentOrderStartTime: '07:30',
  currentOrderEndTime: '11:00',
  preOrderStartTime: '14:00',
  preOrderEndTime: '23:59',
  priceChangeThreshold: 10.0,
  priceConfirmTimeout: 30,
  lineNotificationEnabled: true
};

export const prismaSystemConfigRepository: SystemConfigRepository = {
  async get() {
    const config = await prisma.systemConfig.findUnique({
      where: { id: 'system-config' }
    });

    if (!config) {
      throw new Error('System configuration not found. Please initialize first.');
    }

    return config as SystemConfigData;
  },

  async update(data) {
    const config = await prisma.systemConfig.upsert({
      where: { id: 'system-config' },
      create: { ...DEFAULT_CONFIG, ...data },
      update: data
    });

    return config as SystemConfigData;
  },

  async getOrCreate() {
    const existing = await prisma.systemConfig.findUnique({
      where: { id: 'system-config' }
    });

    if (existing) {
      return existing as SystemConfigData;
    }

    const config = await prisma.systemConfig.create({
      data: DEFAULT_CONFIG
    });

    return config as SystemConfigData;
  }
};
