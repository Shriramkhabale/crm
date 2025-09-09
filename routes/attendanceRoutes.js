const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const authMiddleware = require('../middleware/authMiddleware');

// Mark or update attendance
router.post('/', authMiddleware, attendanceController.markAttendance);

// Get attendance records (with optional filters)
router.get('/', authMiddleware, attendanceController.getAttendanceRecords);

// Get attendance by ID
router.get('/:id', authMiddleware, attendanceController.getAttendanceById);

// update attendance by ID
router.put('/:id', authMiddleware, attendanceController.updateAttendance);


// Delete attendance by ID
router.delete('/:id', authMiddleware, attendanceController.deleteAttendance);

module.exports = router;