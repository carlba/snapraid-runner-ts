const { exec, spawn } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const fs = require('fs');
const cron = require('node-cron');

const containers = [
  'media-server-plex-1',
  'media-server-transmission-1',
  'bazarr',
  'radarr',
  'sonarr',
  'resilio-sync',
  'media-server-plextraktsync-1',
  'media-server-grafana-1',
  'media-server-flexget-1',
];

const PUSHOVER_TOKEN = process.env.PUSHOVER_TOKEN;
const PUSHOVER_USER = process.env.PUSHOVER_USER;
const SCRUB_PERCENTAGE = process.env.SCRUB_PERCENTAGE ?? '1';
const TIMEZONE = process.env.TIMEZONE ?? 'America/Mexico_City';
const CRON_SCHEDULE = process.env.CRON_SCHEDULE ?? '* * * * *';

let isRunning = false;
const abortController = new AbortController();

console.info('ENV', { PUSHOVER_TOKEN, PUSHOVER_USER, SCRUB_PERCENTAGE, TIMEZONE, CRON_SCHEDULE });

const task = cron.schedule(
  CRON_SCHEDULE,
  () => {
    if (!isRunning) {
      console.log('Running scheduled task');
      isRunning = true;
      manageContainers().finally(() => {
        isRunning = false;
      });
    }
  },
  { timezone: TIMEZONE, scheduled: false }
);

const createSymlink = () => {
  const target = '/etc/snapraid.conf';
  const link = '/config/snapraid.conf';

  fs.symlink(link, target, 'file', err => {
    if (err) {
      if (err.code === 'EEXIST') {
        console.log('Symlink already exists');
      } else {
        console.error('Error creating symlink:', err);
      }
    } else {
      console.log('Symlink created successfully');
    }
  });
};

createSymlink();

const sendPushoverNotification = async message => {
  try {
    const title = 'Snapraid Sync';
    const sound = 'pushover';

    const response = await fetch('https://api.pushover.net/1/messages.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: PUSHOVER_TOKEN,
        user: PUSHOVER_USER,
        message,
        title,
        sound,
        priority: 1,
      }),
    });
    const data = await response.json();
    console.log('Pushover notification sent:', data);
  } catch (err) {
    console.error('Error sending Pushover notification:', err);
  }
};

const spawnAsync = (command, args = [], options = {}) => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options);
    let stderr = '';
    let stdout = '';
    let output = '';

    // Capture stderr
    child.stderr.on('data', data => {
      console.log(data.toString());
      stderr += data.toString();
      output += data.toString();
    });

    child.stdout.on('data', data => {
      console.log(data.toString());
      stdout += data.toString();
      output += data.toString();
    });

    // Handle process close
    child.on('exit', (code, signal) => {
      if (abortController.signal.aborted) {
        reject({
          message: `Process was aborted ${abortController.signal.reason}`,
          code,
          stdout,
          stderr,
          output,
        });
      }
      if (code === 0) {
        resolve({ code, stdout, stderr, output });
      } else {
        reject({ code, stdout, stderr, output });
      }
    });

    // Handle process errors
    child.on('error', error => {
      if (error.name === 'AbortError') {
        console.error(`${error.message}: ${abortController.signal.reason}`);
      } else {
        console.error(`Error while running process ${error}`);
      }
    });
  });
};

async function manageContainer(container, action, abort = false) {
  if (!['start', 'stop'].includes(action)) {
    throw new Error(`${action} is not a valid container action`);
  }
  try {
    const { stdout } = await execAsync(
      `docker ${action} ${container}`,
      abort ? { signal: abortController.signal } : {}
    );
    console.log(`Container ${container} ${action}ed successfully:`, stdout);
  } catch (error) {
    throw new Error(
      `Error while managing container ${error.message} ${error.stderr ?? ''} ${error.stdout ?? ''}`
    );
  }
}

async function snapraidSync() {
  try {
    const { output, code } = await spawnAsync('snapraid', ['sync'], {
      signal: abortController.signal,
    });
    return { output, code };
  } catch (error) {
    console.error('Error while syncing', error);
    throw new Error(
      `Error while syncing ${error.message} ${error.stderr ?? ''} ${error.stdout ?? ''}`
    );
  }
}

async function snapraidScrub() {
  try {
    const { code, output } = await spawnAsync('snapraid', ['scrub', '-p', SCRUB_PERCENTAGE], {
      signal: abortController.signal,
    });
    return { output, code };
  } catch (error) {
    console.error('Error while scrubbing', error);
    throw new Error(
      `Error while scrubbing ${error.message} ${error.stderr ?? ''} ${error.stdout ?? ''}`
    );
  }
}

async function manageContainers() {
  try {
    for (const container of containers) {
      if (abortController.signal.aborted) {
        throw Error(abortController.signal.reason);
      }
      await manageContainer(container, 'stop', true);
    }
    const { output: syncOutput, syncCode } = await snapraidSync();
    const { output: scrubOutput, scrubCode } = await snapraidScrub();

    const combinedOutput = `Sync Output:\n${syncOutput}\nSync Code: ${syncCode}\nScrub Output:\n${scrubOutput}\nScrub Code: ${scrubCode}`;
    await sendPushoverNotification(combinedOutput);
  } catch (error) {
    console.error(`${error.message} ${error.stdout ?? ''} ${error.stderr ?? ''}`);

    await sendPushoverNotification(
      `Message: ${error.message} ${error.stdout ? `Stdout: ${error.stdout}\n` : ''} ${
        error.stderr ? `Stderr: ${error.stderr}\n` : ''
      }`
    );
  } finally {
    try {
      for (const container of containers) {
        await manageContainer(container, 'start', false);
      }
    } catch (error) {
      console.error(
        `Failed to recover after error due to ${error.message} ${error.stdout ?? ''} ${error.stderr ?? ''}`
      );
    }
  }
}

task.start();

// manageContainers().then();

function handleSignal(signal) {
  abortController.abort(`Parent process was stopped ${signal}`);
  task.stop();
}

process.on('SIGINT', () => handleSignal('SIGINT'));
process.on('SIGTERM', () => handleSignal('SIGTERM'));
process.on('SIGHUP', () => handleSignal('SIGHUP'));
