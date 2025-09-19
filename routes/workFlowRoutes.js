const express = require('express');
const router = express.Router();
const workflowController = require('../controllers/workflowController');
const authMiddleware = require('../middleware/authMiddleware'); // your authentication middleware

// Protect all routes - only authenticated users can access
router.use(authMiddleware);

// Create a new workflow
router.post('/', workflowController.createWorkflow);

// Get all workflows for the logged-in user's company
router.get('/', workflowController.getWorkflows);

// Get a workflow by ID
router.get('/:id', workflowController.getWorkflowById);

// Update a workflow by ID
router.put('/:id', workflowController.updateWorkflow);

// Delete a workflow by ID
router.delete('/:id', workflowController.deleteWorkflow);

module.exports = router;
