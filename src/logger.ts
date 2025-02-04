import pino from 'pino';

export const PRETTIFY_LOGS = process.env.PRETTIFY_LOGS === 'true';

const pinoTransport = {
  target: 'pino-pretty',
  options: { ignore: 'time,pid,hostname,context', messageFormat: `[{context}]: {msg}` },
};

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  ...(PRETTIFY_LOGS ? { transport: pinoTransport } : {}),
  serializers: { err: pino.stdSerializers.wrapErrorSerializer(err => ({ ...err, stack: null })) },
}).child({ context: 'main' });
