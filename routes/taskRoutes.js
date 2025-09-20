// taskRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const taskController = require('../controllers/taskController');
const upload = require('../middleware/uploadImages'); // multer-cloudinary middleware

// router.post('/tasks', authMiddleware, taskController.createTask);

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
// router.put('/tasks/:id', authMiddleware, taskController.updateTask);
// Update task with file uploads-
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

router.delete('/tasks/:id', authMiddleware, taskController.deleteTask);

router.put('/:taskId/shifttask', authMiddleware, taskController.shiftedTask);
router.get('/tasks/employee/:employeeId', taskController.getTasksByEmployeeId);

// Add these routes below existing ones

// Get credit points task-wise
router.get('/creditpoints', authMiddleware, taskController.getCreditPointsTaskWise);

// Get credit points employee-wise
router.get('/creditpoints/employees', authMiddleware, taskController.getCreditPointsEmployeeWise);


module.exports = router;