import { logger } from './logger';

export const sendPushoverNotification = async (
  message: string,
  token: string,
  userToken: string,
  options: { priority: number; title?: string } = { priority: 0 }
): Promise<void> => {
  try {
    const title = `Snapraid Runner ${options.title ? '- ' + options.title : ''}`;
    const sound = 'pushover';

    const response = await fetch('https://api.pushover.net/1/messages.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token,
        user: userToken,
        message,
        title,
        sound,
        priority: options.priority,
      }),
    });
    const data = await response.json();
    logger.info(data, 'Pushover notification sent:');
  } catch (err) {
    logger.error(err, 'Error sending Pushover notification');
  }
};
