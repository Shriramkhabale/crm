//todosRouter.js
const express = require('express');
const router = express.Router();
const todosController = require('../controllers/todosController');
const authMiddleware = require('../middleware/authMiddleware'); // your auth middleware

// Protect all routes below with authentication middleware
router.use(authMiddleware);

// Create a new To-Do
router.post('/', todosController.createTodo);

// Get all To-Dos for logged-in user
router.get('/', todosController.getTodos);

// Get a single To-Do by ID
router.get('/:id', todosController.getTodoById);

// Update a To-Do by ID
router.put('/:id', todosController.updateTodo);

// Delete a To-Do by ID
router.delete('/:id', todosController.deleteTodo);

module.exports = router;
