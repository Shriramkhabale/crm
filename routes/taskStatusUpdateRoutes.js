// //routes/taskStatusUpdateRoutes.js

// const express = require('express');
// const router = express.Router();
// const taskStatusUpdateController = require('../controllers/taskStatusUpdateController');


// const authMiddleware = require('../middleware/authMiddleware');
// router.get('/reassigned-tasks', authMiddleware, taskStatusUpdateController.getReassignedTasksForCompany);

// // Update task status and save history
// router.put('/:taskId/status', authMiddleware, taskStatusUpdateController.updateTaskStatus);
// // Optionally, get status update history for a task
// router.get('/:taskId/status-updates', authMiddleware, taskStatusUpdateController.getTaskStatusUpdates);
// module.exports = router;


const express = require('express');
const router = express.Router();
const taskStatusUpdateController = require('../controllers/taskStatusUpdateController');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadImages'); // your multer-cloudinary middleware

// Update task status and save history with file uploads
router.put(
  '/:taskId/status',
  authMiddleware,
  upload.fields([
    { name: 'image'},
    { name: 'file' },
    { name: 'audio' }
  ]),
  taskStatusUpdateController.updateTaskStatusWithFiles
);

// Get status update history for a task
router.get('/:taskId/status-updates', authMiddleware, taskStatusUpdateController.getTaskStatusUpdates);

router.get('/reassigned-tasks', authMiddleware, taskStatusUpdateController.getReassignedTasksForCompany);

module.exports = router;