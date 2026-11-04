import type { Params } from 'nestjs-pino';

const isProduction = process.env.NODE_ENV === 'production';

export const loggerParams: Params = {
  pinoHttp: {
    level: process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug'),
    transport: isProduction
      ? undefined
      : {
          target: 'pino-pretty',
          options: { singleLine: true, translateTime: 'SYS:HH:MM:ss.l' },
        },
    // Redact secrets and per-visitor identifiers. Bodies are never logged.
    redact: {
      paths: [
        'req.headers["x-visitor-id"]',
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
      ],
      remove: true,
    },
  },
};
