import '@tanstack/react-start/server-only'

import pino from 'pino'

const isProduction = process.env.NODE_ENV === 'production'

export const logger = pino({
  name: 'stoic-quote-web',
  level: process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug'),
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { singleLine: true, translateTime: 'SYS:HH:MM:ss.l' },
        },
      }),
})
