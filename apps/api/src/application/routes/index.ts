import { Router } from 'express';
import type { OrderController } from '../controllers/order.controller';
import type { ProductController } from '../controllers/product.controller';
import type { AuthController } from '../controllers/auth.controller';
import type { DriverController } from '../controllers/driver.controller';
import type { DriverOrdersController } from '../controllers/driver-orders.controller';
import type { DriverRouteController } from '../controllers/driver-route.controller';
import type { UserManagementController } from '../controllers/user-management.controller';
import type { AdminOrdersController } from '../controllers/admin-orders.controller';
import type { AdminProductsController } from '../controllers/admin-products.controller';
import type { AdminDeliveryController } from '../controllers/admin-delivery.controller';
import type { DriverDeliveryController } from '../controllers/driver-delivery.controller';
import type { AdminSettingsController } from '../controllers/admin-settings.controller';
import { createOrderRouter } from './order.routes';
import { createProductRouter } from './product.routes';
import { createAuthRouter } from './auth.routes';
import { createDriverRouter } from './driver.routes';
import { createAdminUsersRouter } from './admin_users.routes';
import { createAdminOrdersRouter } from './admin_orders.routes';
import { createAdminProductsRouter } from './admin_products.routes';
import { createAdminDeliveryRouter } from './admin_delivery.routes';
import { createAdminSettingsRouter } from './admin_settings.routes';

export interface RouteDependencies {
  orderController: OrderController;
  productController: ProductController;
  authController: AuthController;
  driverController: DriverController;
  driverOrdersController: DriverOrdersController;
  driverDeliveryController: DriverDeliveryController;
  driverRouteController: DriverRouteController;
  userManagementController: UserManagementController;
  adminOrdersController: AdminOrdersController;
  adminProductsController: AdminProductsController;
  adminDeliveryController: AdminDeliveryController;
  adminSettingsController: AdminSettingsController;
}

export const createRoutes = ({ orderController, productController, authController, driverController, driverOrdersController, driverDeliveryController, driverRouteController, userManagementController, adminOrdersController, adminProductsController, adminDeliveryController, adminSettingsController }: RouteDependencies): Router => {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'api' });
  });

  router.use('/orders', createOrderRouter(orderController));
  router.use('/products', createProductRouter(productController));
  router.use('/auth', createAuthRouter(authController));
  router.use('/drivers', createDriverRouter(driverController, driverOrdersController, driverDeliveryController, driverRouteController));
  router.use('/admin/users', createAdminUsersRouter(userManagementController));
  router.use('/admin/orders', createAdminOrdersRouter(adminOrdersController));
  router.use('/admin/products', createAdminProductsRouter(adminProductsController));
  router.use('/admin/delivery', createAdminDeliveryRouter(adminDeliveryController));
  router.use('/admin/settings', createAdminSettingsRouter(adminSettingsController));

  return router;
};
