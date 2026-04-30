export const sendPushNotification = async (token: string, title: string, body: string, data?: object) => {
  if (!token || !token.startsWith('ExponentPushToken')) return;

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Accept-Encoding': 'gzip, deflate' },
    body: JSON.stringify({ to: token, title, body, data: data ?? {}, sound: 'default' }),
  });
};
