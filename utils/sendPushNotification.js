let expoInstance = null;
let ExpoClass = null;

async function getExpo() {
  if (!ExpoClass) {
    const expoModule = await import('expo-server-sdk');
    ExpoClass = expoModule.Expo;
  }

  if (!expoInstance) {
    expoInstance = new ExpoClass();
  }

  return expoInstance;
}

async function sendPushNotification(tokens, title, body, data = {}) {
  if (!tokens || tokens.length === 0) return;

  const expo = await getExpo();

  const messages = [];

  for (const token of tokens) {
    if (!ExpoClass.isExpoPushToken(token)) continue;

    messages.push({
      to: token,
      sound: 'default',
      title,
      body,
      data,
    });
  }

  if (messages.length === 0) return;

  const chunks = expo.chunkPushNotifications(messages);

  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (err) {
      console.log('Push notification error:', err);
    }
  }
}

module.exports = sendPushNotification;