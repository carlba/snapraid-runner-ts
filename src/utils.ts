import { CmdError } from './exceptions';

import fs from 'fs';
import { logger } from './logger';
import { spawn } from 'child_process';

export const spawnAsync = (
  command: string,
  args: string[] = [],
  options: { signal?: AbortSignal } = {}
): Promise<{ code: number | null; stdout: string; stderr: string; output: string }> => {
  return new Promise((resolve, reject) => {
    const context = `${command}${args ? '-' + args[0] : ''}`;

    const localLogger = logger.child({ context });
    const child = spawn(command, args, options);
    let stderr = '';
    let stdout = '';
    const output = '';

    // Capture stderr
    child.stderr.on('data', (data: Buffer) => {
      localLogger.error(data.toString().trim());
      stderr += data.toString();
    });

    child.stdout.on('data', (data: Buffer) => {
      localLogger.info(data.toString().trim());
      stdout += data.toString();
    });

    // Handle process close
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    child.on('exit', (code, signal) => {
      if (options.signal?.aborted) {
        reject(
          new CmdError(`Process was aborted ${options.signal?.reason ?? ''}`, {
            code,
            stdout,
            stderr,
          })
        );
      }
      if (code === 0) {
        resolve({ code, stdout, stderr, output });
      } else {
        reject(
          new CmdError(`Process exited with ${code}`, {
            code,
            stdout,
            stderr,
          })
        );
      }
    });

    // Handle process errors
    child.on('error', error => {
      if (error.name === 'AbortError') {
        logger.error(`${error.message}: ${options.signal?.reason ?? ''}`);
      } else {
        logger.error(`Error while running process ${error}`);
      }
    });
  });
};

export const createSymlink = () => {
  const target = '/etc/snapraid.conf';
  const link = '/config/snapraid.conf';

  fs.symlink(link, target, 'file', err => {
    if (err) {
      if (err.code === 'EEXIST') {
        logger.warn('Symlink already exists');
      } else {
        logger.error(err, 'Error creating symlink');
      }
    } else {
      logger.debug('Symlink created successfully');
    }
  });
};

export function panic(message: string): never {
  logger.error(message);
  process.exit(0);
}
