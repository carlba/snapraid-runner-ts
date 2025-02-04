import pino from 'pino';
import util from 'util';
import { exec } from 'child_process';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
});

logger.info('This is an info log');
logger.error('This is an error log');
logger.info({ context: 'Request' }, 'This happened in a request');

class CustomError extends Error {
  code?: number;
  details?: Record<string, unknown>;

  constructor(
    message: string,
    options?: ErrorOptions & { code?: number; details?: Record<string, unknown> }
  ) {
    super(message, options);

    if (options?.code) {
      this.code = options.code;
    }

    if (options?.details) {
      this.details = options.details;
    }
    Error.captureStackTrace(this, this.constructor);
  }
}

logger.error(new Error('Error'), 'Error While');
logger.error(
  new CustomError('This is a customError', { code: 400, details: { status: 'ok' } }),
  'Error While'
);

const loggerWithSerializer = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: { target: 'pino-pretty' },
});

logger.error(new CustomError('This is a customError', { code: 400 }));

const execAsync = util.promisify(exec);

async function run() {
  try {
    await execAsync('stail -f /var/log/test');
  } catch (error) {
    loggerWithSerializer.error(error, 'Error while doing things');
  }
}

run().catch(error => console.error(error));
