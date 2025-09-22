const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationTrackingController');
const authMiddleware = require('../middleware/authMiddleware');  // Your auth middleware
const authorizeRole = require('../middleware/authorizeRole');   // Optional: For admin-only routes

// Protect all routes with auth
router.use(authMiddleware);

// Save batch of locations (for field engineers)
router.post('/track-batch', locationController.createLocationBatch);

// Get location history (for company admins)
router.get('/history', authorizeRole('admin', 'company'), locationController.getLocationHistory);

// Get last location (for quick checks)
router.get('/last/:employeeId', authorizeRole('admin', 'company'), locationController.getLastLocation);

module.exports = router;