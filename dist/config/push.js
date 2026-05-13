"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPushNotification = void 0;
const sendPushNotification = async (token, title, body, data) => {
    if (!token || !token.startsWith('ExponentPushToken'))
        return;
    await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Accept-Encoding': 'gzip, deflate' },
        body: JSON.stringify({ to: token, title, body, data: data ?? {}, sound: 'default' }),
    });
};
exports.sendPushNotification = sendPushNotification;
