//routes/locationTrackingRoutes.js

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

const {
  createLocationBatch,
  getLocationHistory,
  getLastLocation,
  getCloudinaryUrl
} = require('../controllers/locationTrackingController');

// POST /api/location/track-batch - Any authenticated employee
router.post('/track-batch', authMiddleware, createLocationBatch);

// GET /api/location/history - Any authenticated user in company
router.get('/history', authMiddleware, getLocationHistory);

// GET /api/location/last/:employeeId - Any authenticated user in company
router.get('/last/:employeeId', authMiddleware, getLastLocation);

// GET /api/location/cloudinary-url/:employeeId - Android fetches Cloudinary URL for iOS/Android location JSON
// Optional query: ?taskId=<taskId>
router.get('/cloudinary-url/:employeeId', authMiddleware, getCloudinaryUrl);

module.exports = router;
