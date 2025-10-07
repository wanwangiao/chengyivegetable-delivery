import { Router } from 'express';
import type { OrderController } from '../controllers/order.controller';
import type { ProductController } from '../controllers/product.controller';
import type { AuthController } from '../controllers/auth.controller';
import type { DriverController } from '../controllers/driver.controller';
import type { UserManagementController } from '../controllers/user-management.controller';
import type { AdminOrdersController } from '../controllers/admin-orders.controller';
import type { AdminProductsController } from '../controllers/admin-products.controller';
import type { AdminDeliveryController } from '../controllers/admin-delivery.controller';
import type { DriverDeliveryController } from '../controllers/driver-delivery.controller';
import { createOrderRouter } from './order.routes';
import { createProductRouter } from './product.routes';
import { createAuthRouter } from './auth.routes';
import { createDriverRouter } from './driver.routes';
import { createAdminUsersRouter } from './admin_users.routes';
import { createAdminOrdersRouter } from './admin_orders.routes';
import { createAdminProductsRouter } from './admin_products.routes';
import { createAdminDeliveryRouter } from './admin_delivery.routes';

export interface RouteDependencies {
  orderController: OrderController;
  productController: ProductController;
  authController: AuthController;
  driverController: DriverController;
  driverDeliveryController: DriverDeliveryController;
  userManagementController: UserManagementController;
  adminOrdersController: AdminOrdersController;
  adminProductsController: AdminProductsController;
  adminDeliveryController: AdminDeliveryController;
}

export const createRoutes = ({ orderController, productController, authController, driverController, driverDeliveryController, userManagementController, adminOrdersController, adminProductsController, adminDeliveryController }: RouteDependencies): Router => {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'api' });
  });

  router.use('/orders', createOrderRouter(orderController));
  router.use('/products', createProductRouter(productController));
  router.use('/auth', createAuthRouter(authController));
  router.use('/drivers', createDriverRouter(driverController, driverDeliveryController));
  router.use('/admin/users', createAdminUsersRouter(userManagementController));
  router.use('/admin/orders', createAdminOrdersRouter(adminOrdersController));
  router.use('/admin/products', createAdminProductsRouter(adminProductsController));
  router.use('/admin/delivery', createAdminDeliveryRouter(adminDeliveryController));

  return router;
};
