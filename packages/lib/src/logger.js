import pino from 'pino';
const isDevelopment = process.env.NODE_ENV !== 'production';
export const logger = pino({
    name: 'chengyi-veg-platform',
    level: process.env.LOG_LEVEL ?? 'info',
    transport: isDevelopment
        ? {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard'
            }
        }
        : undefined
});
//# sourceMappingURL=logger.js.map