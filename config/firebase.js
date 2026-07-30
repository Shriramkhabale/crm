// config/firebase.js
// Firebase Admin SDK initialization for FCM push notifications
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = path.join(__dirname, '..', 'service-account.json');

if (fs.existsSync(serviceAccountPath)) {
  try {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: "https://digischoolweb-default-rtdb.firebaseio.com"
    });
    console.log('✅ Firebase Admin SDK initialized');
  } catch (err) {
    console.error('❌ Firebase Admin SDK initialization failed:', err.message);
  }
} else {
  console.warn('⚠️ service-account.json not found at', serviceAccountPath);
  console.warn('⚠️ Push notifications will NOT be sent until you add this file.');
}

module.exports = admin;
