const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectMgntController');
const authMiddleware = require('../middleware/authMiddleware'); 

// Create a new project
router.post('/', authMiddleware, projectController.createProject);

// Get all projects for the company
router.get('/', authMiddleware, projectController.getAllProjects);

// Get project by ID
router.get('/:id', authMiddleware, projectController.getProjectById);

// Update project by ID
router.put('/:id', authMiddleware, projectController.updateProject);

// Delete project by ID
router.delete('/:id', authMiddleware, projectController.deleteProject);

module.exports = router;