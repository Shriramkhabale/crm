// routes/shiftRoutes.js
const express = require('express');
const router = express.Router();
const shiftController = require('../controllers/shiftController');
const authMiddleware = require('../middleware/authMiddleware'); // if you want to protect routes

// Create shift
router.post('/', authMiddleware, shiftController.createShift);

// Get all shifts
router.get('/', authMiddleware, shiftController.getAllShifts);

// Get shift by ID
router.get('/:shiftId', authMiddleware, shiftController.getShiftById);

// Update shift
router.put('/:shiftId', authMiddleware, shiftController.updateShift);

// Delete shift
router.delete('/:shiftId', authMiddleware, shiftController.deleteShift);

module.exports = router;