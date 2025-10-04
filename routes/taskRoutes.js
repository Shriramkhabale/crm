// taskRoutes.js (complete corrected file)
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const taskController = require('../controllers/taskController');
const upload = require('../middleware/uploadImages'); // multer-cloudinary middleware

// Create task with file uploads
router.post(
  '/tasks',
  authMiddleware,
  upload.fields([
    { name: 'images', maxCount: 15 },
    { name: 'audios', maxCount: 15 },
    { name: 'files', maxCount: 15 },
  ]),
  taskController.createTask
);

router.get('/tasks', authMiddleware, taskController.getAllTasks);
router.get('/tasks/:id', authMiddleware, taskController.getTaskById);

router.put(
  '/tasks/:id',
  authMiddleware,
  upload.fields([
    { name: 'images', maxCount: 15 },
    { name: 'audios', maxCount: 15 },
    { name: 'files', maxCount: 15 },
  ]),
  taskController.updateTask
);

router.delete('/tasks/:id', authMiddleware, taskController.deleteTask);  // Handles ?deleteSeries=true

router.put('/:taskId/shifttask', authMiddleware, taskController.shiftedTask);
router.get('/tasks/employee/:employeeId', authMiddleware, taskController.getTasksByEmployeeId);  // FIXED: Added auth

// Get credit points task-wise
router.get('/creditpoints', authMiddleware, taskController.getCreditPointsTaskWise);

// Get credit points employee-wise
router.get('/creditpoints/employees', authMiddleware, taskController.getCreditPointsEmployeeWise);

// NEW: Recurring management routes (FIXED: Correct syntax with comma, no space/period)
router.put('/tasks/:id/stop-recurrence', authMiddleware, taskController.stopRecurrence);
router.put('/tasks/:id/resume-recurrence', authMiddleware, taskController.resumeRecurrence);

module.exports = router;