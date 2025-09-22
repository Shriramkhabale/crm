//routes/locationTrackingRoutes.js

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

const {
  createLocationBatch,
  getLocationHistory,
  getLastLocation
} = require('../controllers/locationTrackingController');

// POST /api/location/track-batch - Any authenticated employee
router.post('/track-batch', authMiddleware, createLocationBatch);

// GET /api/location/history - Any authenticated user in company
router.get('/history', authMiddleware, getLocationHistory);

// GET /api/location/last/:employeeId - Any authenticated user in company
router.get('/last/:employeeId', authMiddleware, getLastLocation);

module.exports = router;
