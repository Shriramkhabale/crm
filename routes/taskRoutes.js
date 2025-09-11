// taskRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const taskController = require('../controllers/taskController');

router.post('/tasks', authMiddleware, taskController.createTask);
router.get('/tasks', authMiddleware, taskController.getAllTasks);
router.get('/tasks/:id', authMiddleware, taskController.getTaskById);
router.put('/tasks/:id', authMiddleware, taskController.updateTask);
router.delete('/tasks/:id', authMiddleware, taskController.deleteTask);

router.put('/:taskId/shifttask', authMiddleware, taskController.shiftedTask);

module.exports = router;