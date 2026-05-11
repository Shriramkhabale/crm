const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../middleware/multerCloudinary'); // multer-cloudinary middleware

// Mark or update attendance
// router.post('/', authMiddleware, attendanceController.markAttendance);

router.post(
  '/',
  authMiddleware,
  upload.fields([
    { name: 'inPhoto', maxCount: 1 },
    { name: 'outPhoto', maxCount: 1 }
  ]),
  attendanceController.markAttendanceWithImages
);

// Punch In - for clocking in (start of day or after breaks)
router.post(
  '/punch-in',
  authMiddleware,
  upload.fields([
    { name: 'inPhoto', maxCount: 1 }
  ]),
  attendanceController.punchIn
);

// Punch Out - for clocking out (breaks or end of day)
router.post(
  '/punch-out',
  authMiddleware,
  upload.fields([
    { name: 'outPhoto', maxCount: 1 }
  ]),
  attendanceController.punchOut
);

// Get punch status for employee on specific date
router.get('/punch-status/:employee/:date', authMiddleware, attendanceController.getPunchStatus);

// Get all punches for employee on specific date
router.get('/punches/:employee/:date', authMiddleware, attendanceController.getPunches);

// Get attendance records (with optional filters)
router.get('/', authMiddleware, attendanceController.getAttendanceRecords);

// Manual attendance routes
router.post('/manual', authMiddleware, attendanceController.addManualAttendance);
router.post('/manual/bulk', authMiddleware, attendanceController.addBulkManualAttendance);
router.put('/manual/:id', authMiddleware, attendanceController.updateManualAttendance);
router.delete('/manual/:id', authMiddleware, attendanceController.deleteManualAttendance);

// Get attendance by ID
router.get('/:id', authMiddleware, attendanceController.getAttendanceById);

// update attendance by ID
// router.put('/:id', authMiddleware, attendanceController.updateAttendance);

// Update attendance by ID with image upload support
router.put(
  '/:id',
  authMiddleware,
  upload.fields([
    { name: 'inPhoto', maxCount: 1 },
    { name: 'outPhoto', maxCount: 1 }
  ]),
  attendanceController.updateAttendanceWithImages
);

// Delete attendance by ID
router.delete('/:id', authMiddleware, attendanceController.deleteAttendance);

module.exports = router;