const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadImages'); // multer-cloudinary middleware

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

// Get attendance records (with optional filters)
router.get('/', authMiddleware, attendanceController.getAttendanceRecords);

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