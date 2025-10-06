import { env } from '../../config/env';
import { prismaOrderRepository } from '../../infrastructure/prisma/order.repository';
import { prismaLineUserRepository } from '../../infrastructure/prisma/line-user.repository';
import { prismaDriverRepository } from '../../infrastructure/prisma/driver.repository';
import { LineNotifier } from '../../infrastructure/notifications/line-notifier';
import { NotificationService } from '../services/notification.service';

const lineNotifier = new LineNotifier(env.LINE_CHANNEL_ACCESS_TOKEN);

NotificationService.register(
  prismaOrderRepository,
  prismaLineUserRepository,
  prismaDriverRepository,
  lineNotifier
);
