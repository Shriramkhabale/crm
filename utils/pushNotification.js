// utils/pushNotification.js
// Sends push notifications to Android devices via Firebase Cloud Messaging
const admin = require('../config/firebase');

/**
 * Sends a push notification to a user's Android device.
 * @param {string} userId - The MongoDB ID of the user (e.g., "6a2bed81f4e67d966664d25a")
 * @param {string} title - The notification title (e.g., "Task Assigned")
 * @param {string} body - The notification message text
 * @param {string} type - The routing type ("task_added", "lead_added", or "project_added")
 */
async function sendPushNotification(userId, title, body, type) {
  try {
    // Check if Firebase is initialized
    if (!admin || !admin.apps || admin.apps.length === 0) {
      return;
    }

    // 1. Fetch the user's FCM token from Firebase Realtime Database
    const dbRef = admin.database().ref(`CRM/${userId}/fcmTokens/android`);
    const snapshot = await dbRef.once('value');
    const fcmData = snapshot.val();

    if (!fcmData || !fcmData.token || !fcmData.active) {
      console.log(`No active FCM token found for user: ${userId}`);
      return;
    }

    const deviceToken = fcmData.token;

    // 2. Prepare the data-only payload (crucial for showing when the app is closed)
    const message = {
      data: {
        title: String(title || ''),
        body: String(body || ''),
        type: String(type || '')
      },
      android: {
        priority: "high" // Delivers instantly even if device is sleeping
      },
      token: deviceToken
    };

    // 3. Send the notification via Firebase Messaging
    const response = await admin.messaging().send(message);
    console.log(`✅ Push notification sent to ${userId}:`, response);
  } catch (error) {
    // Handle invalid/expired tokens gracefully
    if (error.code === 'messaging/registration-token-not-registered' ||
        error.code === 'messaging/invalid-registration-token') {
      console.warn(`⚠️ Invalid/expired FCM token for user ${userId}, skipping.`);
    } else {
      console.error(`❌ Error sending push notification to ${userId}:`, error.message || error);
    }
  }
}

/**
 * Sends push notifications to multiple users in parallel.
 * @param {string[]} userIds - Array of MongoDB user IDs
 * @param {string} title - The notification title
 * @param {string} body - The notification message text
 * @param {string} type - The routing type ("task_added", "lead_added", or "project_added")
 */
async function sendPushNotificationToMany(userIds, title, body, type) {
  if (!Array.isArray(userIds) || userIds.length === 0) return;

  const promises = userIds
    .filter(id => id) // Remove null/undefined
    .map(id => sendPushNotification(id.toString(), title, body, type));

  await Promise.allSettled(promises);
}

module.exports = {
  sendPushNotification,
  sendPushNotificationToMany
};
