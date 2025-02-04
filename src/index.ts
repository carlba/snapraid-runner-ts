import { exec } from 'child_process';
import util from 'util';

import cron from 'node-cron';

import type { ScheduledTask } from 'node-cron';
import { createSymlink, panic, spawnAsync } from './utils';
import { logger, PRETTIFY_LOGS } from './logger';
import { sendPushoverNotification } from './pushover';

const execAsync = util.promisify(exec);

const containers: string[] = [
  'media-server-plex-1',
  'media-server-transmission-1',
  'bazarr',
  'radarr',
  'sonarr',
  'resilio-sync',
  'media-server-plextraktsync-1',
  // 'media-server-grafana-1',
  'media-server-flexget-1',
];

const PUSHOVER_TOKEN = process.env.PUSHOVER_TOKEN ?? panic('PUSHOVER_TOKEN is required');
const PUSHOVER_USER = process.env.PUSHOVER_USER ?? panic('PUSHOVER_USER is required');
const SCRUB_PERCENTAGE = process.env.SCRUB_PERCENTAGE ?? '1';
const TIMEZONE = process.env.TIMEZONE ?? 'America/Mexico_City';
const CRON_SCHEDULE = process.env.CRON_SCHEDULE ?? '* * * * *';
const DISABLE_CRON = process.env.DISABLE_CRON === 'true';

let isRunning = false;
const abortController = new AbortController();

logger.info('ENV', {
  PUSHOVER_TOKEN,
  PUSHOVER_USER,
  SCRUB_PERCENTAGE,
  TIMEZONE,
  CRON_SCHEDULE,
  DISABLE_CRON,
  PRETTIFY_LOGS,
});

createSymlink();

async function manageContainer(
  container: string,
  action: 'start' | 'stop',
  abort = false
): Promise<void> {
  const localLogger = logger.child({ context: 'manageContainer' });
  if (!['start', 'stop'].includes(action)) {
    throw new Error(`${action} is not a valid container action`);
  }
  try {
    await execAsync(
      `docker ${action} ${container}`,
      abort ? { signal: abortController.signal } : {}
    );
    localLogger.info(`Container ${container} ${action}ed successfully`);
  } catch (error) {
    const errorMessage = `Error while managing container ${container}`;
    if (error instanceof Error) {
      localLogger.error(error, errorMessage);

      await sendPushoverNotification(
        `${errorMessage} ${error.message}`,
        PUSHOVER_TOKEN,
        PUSHOVER_USER,
        {
          priority: 1,
        }
      );
    }
    throw new Error(errorMessage);
  }
}

async function snapraidSync(): Promise<{ output: string; code: number | null }> {
  const localLogger = logger.child({ context: 'sync' });

  try {
    return await spawnAsync('snapraid', ['sync'], {
      signal: abortController.signal,
    });
  } catch (error) {
    const errorMessage = 'Error while syncing';
    if (error instanceof Error) {
      localLogger.error(error, errorMessage);

      await sendPushoverNotification(
        `${errorMessage} ${error.message}`,
        PUSHOVER_TOKEN,
        PUSHOVER_USER,
        {
          priority: 1,
        }
      );
    }
    throw new Error(errorMessage);
  }
}

async function snapraidScrub(): Promise<{ output: string; code: number | null }> {
  const localLogger = logger.child({ context: 'scrub' });
  try {
    const { code, output } = await spawnAsync('snapraid', ['scrub', '-p', SCRUB_PERCENTAGE], {
      signal: abortController.signal,
    });
    return { output, code };
  } catch (error) {
    const errorMessage = 'Error while scrubbing';
    if (error instanceof Error) {
      localLogger.error(error, errorMessage);

      await sendPushoverNotification(
        `${errorMessage} ${error.message}`,
        PUSHOVER_TOKEN,
        PUSHOVER_USER,
        {
          priority: 1,
        }
      );
    }
    throw new Error(errorMessage);
  }
}

async function applyActionsToContainers(action: 'start' | 'stop') {
  for (const container of containers) {
    if (abortController.signal.aborted) {
      throw new Error(String(abortController.signal.reason ?? 'aborted'));
    }
    await manageContainer(container, action, true);
  }
}

async function manageContainers(): Promise<void> {
  const localLogger = logger.child({ context: 'manageContainers' });
  try {
    await applyActionsToContainers('stop');
    await snapraidSync();
    localLogger.info('Successfully synced Snapraid');
    await sendPushoverNotification('Successfully synced Snapraid', PUSHOVER_TOKEN, PUSHOVER_USER);
    await snapraidScrub();
    await sendPushoverNotification('Successfully scrubbed Snapraid', PUSHOVER_TOKEN, PUSHOVER_USER);
    localLogger.info('Successfully scrubbed Snapraid');
  } catch (error) {
    logger.error(error);
  } finally {
    try {
      await applyActionsToContainers('start');
    } catch {
      localLogger.error(`Failed to recover after error`);
    }
  }
}

let task: null | ScheduledTask = null;

if (!DISABLE_CRON) {
  task = cron.schedule(
    CRON_SCHEDULE,
    () => {
      if (!isRunning) {
        const localLogger = logger.child({ context: 'cron' });
        localLogger.info('Running scheduled task');
        isRunning = true;
        manageContainers()
          .catch(error => {
            localLogger.error(error, 'Error in scheduled task');
          })
          .finally(() => {
            isRunning = false;
            localLogger.info('Ending scheduled task');
          });
      }
    },
    { timezone: TIMEZONE, scheduled: false }
  );

  task.start();
} else {
  const localLogger = logger.child({ context: 'cli' });
  localLogger.info('Starting run');
  manageContainers()
    .catch(error => {
      localLogger.error(error, 'Error in scheduled task');
    })
    .finally(() => {
      localLogger.info('Ending run');
      isRunning = false;
    });
}

function handleSignal(signal: string): void {
  abortController.abort(`Parent process was stopped ${signal}`);
  if (task) {
    task.stop();
  }
}

process.on('SIGINT', () => handleSignal('SIGINT'));
process.on('SIGTERM', () => handleSignal('SIGTERM'));
process.on('SIGHUP', () => handleSignal('SIGHUP'));
