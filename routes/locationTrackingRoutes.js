//routes/locationTrackingRoutes.js

const express = require('express');
const router = express.Router();

const {
  createLocationBatch,
  getLocationHistory,
  getLastLocation
} = require('../controllers/locationTrackingController');

// POST /api/location/track-batch - Any authenticated employee
router.post('/track-batch', createLocationBatch);

// GET /api/location/history - Any authenticated user in company
router.get('/history', getLocationHistory);

// GET /api/location/last/:employeeId - Any authenticated user in company
router.get('/last/:employeeId', getLastLocation);

module.exports = router;
