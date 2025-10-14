import { Router } from 'express';
import type { LineWebhookController } from '../controllers/line-webhook.controller';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';

export const createLineRouter = (controller: LineWebhookController): Router => {
  const router = Router();

  // LINE Webhook 需要保留 raw body 來驗證簽章，同時需要解析 JSON
  router.post(
    '/webhook',
    express.json({
      verify: (req: Request, _res: Response, buf: Buffer, _encoding: string) => {
        // 保留原始 body 供簽章驗證使用
        (req as any).rawBody = buf.toString('utf-8');
      }
    }),
    controller.webhook
  );

  return router;
};
