//routes/taskStatusUpdateRoutes.js

const express = require('express');
const router = express.Router();
const taskStatusUpdateController = require('../controllers/taskStatusUpdateController');
const authMiddleware = require('../middleware/authMiddleware');
// Update task status and save history
router.put('/:taskId/status', authMiddleware, taskStatusUpdateController.updateTaskStatus);
// Optionally, get status update history for a task
router.get('/:taskId/status-updates', authMiddleware, taskStatusUpdateController.getTaskStatusUpdates);
module.exports = router;