import express, { type Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import multer from 'multer';
import { ZodError } from 'zod';
import { env } from './config/env';
import { storageConfig } from './config/storage';
import { OrderService } from './domain/order-service';
import { ProductService } from './domain/product-service';
import { AuthService } from './domain/auth-service';
import { prismaOrderRepository } from './infrastructure/prisma/order.repository';
import { prismaProductRepository } from './infrastructure/prisma/product.repository';
import { prismaUserRepository } from './infrastructure/prisma/user.repository';
import { prismaDriverRepository } from './infrastructure/prisma/driver.repository';
import { OrderController } from './application/controllers/order.controller';
import { ProductController } from './application/controllers/product.controller';
import { AuthController } from './application/controllers/auth.controller';
import { DriverController } from './application/controllers/driver.controller';
import { UserManagementController } from './application/controllers/user-management.controller';
import { AdminOrdersController } from './application/controllers/admin-orders.controller';
import { AdminProductsController } from './application/controllers/admin-products.controller';
import { createRoutes } from './application/routes';
import { initAuthMiddleware } from './middleware/auth';
import { DriverService } from './domain/driver-service';
import { UserManagementService } from './domain/user-management-service';
import './application/subscribers/order-events';
import { logger } from '@chengyi/lib';
import { initSentry, Sentry } from './config/sentry';
import { DeliveryService } from './domain/delivery-service';
import { AdminDeliveryController } from './application/controllers/admin-delivery.controller';
import { DriverDeliveryController } from './application/controllers/driver-delivery.controller';
import { prismaDeliveryRepository } from './infrastructure/prisma/delivery.repository';
import { GoogleMapsService } from './infrastructure/maps/google-maps.service';
import { DriverOrdersService } from './domain/driver-orders-service';
import { DriverOrdersController } from './application/controllers/driver-orders.controller';
import { DriverRouteController } from './application/controllers/driver-route.controller';
import { prismaDeliveryProofRepository } from './infrastructure/prisma/delivery-proof.repository';
import { SystemConfigService } from './domain/system-config-service';
import { AdminSettingsController } from './application/controllers/admin-settings.controller';
import { prismaSystemConfigRepository } from './infrastructure/prisma/system-config.repository';
import { PriceAlertAutoAcceptService } from './domain/price-alert-auto-accept-service';
import { LineWebhookController } from './application/controllers/line-webhook.controller';
import { createLineRouter } from './application/routes/line.routes';
import { globalLimiter, loginLimiter, orderLimiter } from './middleware/rate-limit';
import { BusinessHoursRepository } from './infrastructure/prisma/business-hours.repository';
import { BusinessHoursService } from './domain/business-hours.service';
import { BusinessHoursController } from './application/controllers/business-hours.controller';
import { prisma } from './infrastructure/prisma/client';

export const createApp = (): Application => {
  // 初始化 Sentry (必須在其他中間件之前)
  initSentry();

  const app = express();

  // Sentry 會在 init() 時自動設定 Express 中間件

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({
    origin: env.NODE_ENV === 'production' ? [/chengyi\.tw$/] : true,
    credentials: true
  }));
  app.use(compression());

  // 應用全域速率限制 (開發環境跳過以利測試)
  if (env.NODE_ENV !== 'development') {
    app.use(globalLimiter);
  }

  // LINE Webhook 路由必須在 express.json() 之前註冊，因為需要原始 body 來驗證簽章
  const lineWebhookController = new LineWebhookController();
  app.use('/api/v1/line', createLineRouter(lineWebhookController));

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use('/uploads', express.static(storageConfig.root));

  const orderRepository = prismaOrderRepository;
  const productRepository = prismaProductRepository;
  const userRepository = prismaUserRepository;
  const driverRepository = prismaDriverRepository;
  const deliveryConfigRepository = prismaDeliveryRepository;
  const deliveryProofRepository = prismaDeliveryProofRepository;
  const mapsService = env.GOOGLE_MAPS_API_KEY
    ? new GoogleMapsService(env.GOOGLE_MAPS_API_KEY)
    : undefined;

  const businessHoursRepository = new BusinessHoursRepository(prisma);
  const businessHoursService = new BusinessHoursService(businessHoursRepository);
  const orderService = new OrderService(orderRepository, businessHoursService);
  const productService = new ProductService(productRepository, orderRepository);
  const authService = new AuthService(userRepository);
  const driverService = new DriverService(driverRepository);
  const driverOrdersService = new DriverOrdersService({
    orderRepository,
    orderService,
    deliveryProofRepository
  });
  const userManagementService = new UserManagementService(userRepository);
  const systemConfigService = new SystemConfigService(prismaSystemConfigRepository);

  const orderController = new OrderController(orderService);
  const productController = new ProductController(productService);
  const authController = new AuthController(authService);
  const driverController = new DriverController(driverService, driverOrdersService);
  const driverOrdersController = new DriverOrdersController(driverOrdersService);
  const userManagementController = new UserManagementController(userManagementService);
  const adminOrdersController = new AdminOrdersController(orderService);
  const adminProductsController = new AdminProductsController(productService);
  const deliveryService = new DeliveryService({
    orderRepository,
    driverRepository,
    deliveryConfigRepository,
    mapsService
  });
  const adminDeliveryController = new AdminDeliveryController(deliveryService);
  const driverDeliveryController = new DriverDeliveryController(deliveryService);
  const driverRouteController = new DriverRouteController(mapsService);
  const adminSettingsController = new AdminSettingsController(systemConfigService);
  const businessHoursController = new BusinessHoursController(businessHoursService);

  initAuthMiddleware(authService);

  app.use('/api/v1', createRoutes({
    orderController,
    productController,
    authController,
    driverController,
    driverOrdersController,
    driverDeliveryController,
    driverRouteController,
    userManagementController,
    adminOrdersController,
    adminProductsController,
    adminDeliveryController,
    adminSettingsController,
    businessHoursController
  }));

  // Sentry 錯誤處理器會在錯誤處理中間件中手動捕獲

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof ZodError) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        issues: err.flatten()
      });
    }

    if (err instanceof multer.MulterError) {
      return res.status(400).json({
        error: 'UPLOAD_ERROR',
        message: err.message
      });
    }

    logger.error(err, 'Unhandled error');

    // 發送錯誤到 Sentry
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(err);
    }

    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  });

  // 啟動價格通知自動接受服務
  if (env.NODE_ENV === 'production') {
    const autoAcceptService = new PriceAlertAutoAcceptService();
    autoAcceptService.startPeriodicCheck();
    logger.info('Price alert auto-accept service started');
  }

  return app;
};
