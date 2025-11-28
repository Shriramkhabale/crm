const express = require('express');
const router = express.Router();
const protect = require('../middleware/protect');
const superEmployeeController = require('../controllers/superEmployeeController');

// Apply authentication middleware to all routes
router.use(protect);

// Create SuperEmployee
router.post('/', superEmployeeController.createSuperEmployee);

// Get all SuperEmployees (with optional filters)
router.get('/', superEmployeeController.getAllSuperEmployees);

// Get SuperEmployee by ID
router.get('/:id', superEmployeeController.getSuperEmployeeById);

// Update SuperEmployee
router.put('/:id', superEmployeeController.updateSuperEmployee);

// Delete SuperEmployee
router.delete('/:id', superEmployeeController.deleteSuperEmployee);

// Toggle SuperEmployee active status
router.patch('/:id/toggle-status', superEmployeeController.toggleSuperEmployeeStatus);

module.exports = router;
