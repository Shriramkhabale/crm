const express = require('express');
const router = express.Router();
const trackingController = require('../controllers/trackingController');
const authMiddleware = require('../middleware/authMiddleware');

// POST /api/tracking/location
router.post('/location', authMiddleware, trackingController.saveLocation);

// GET /api/tracking/route/:employeeId/:date
router.get('/route/:employeeId/:date', authMiddleware, trackingController.getRoute);

// POST /api/tracking/log
router.post('/log', authMiddleware, trackingController.saveLog);

module.exports = router;
