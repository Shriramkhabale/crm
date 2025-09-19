const express = require('express');
const router = express.Router();
const leaveTypeController = require('../controllers/leaveTypeController');
const authMiddleware = require('../middleware/authMiddleware'); // if you have auth

// Create leave type
router.post('/', authMiddleware, leaveTypeController.createLeaveType);

// Get all leave types for a company
router.get('/company/:companyId', authMiddleware, leaveTypeController.getLeaveTypesByCompany);

// Get leave type by ID
router.get('/:id', authMiddleware, leaveTypeController.getLeaveTypeById);

// Update leave type
router.put('/:id', authMiddleware, leaveTypeController.updateLeaveType);

// Delete leave type
router.delete('/:id', authMiddleware, leaveTypeController.deleteLeaveType);

module.exports = router;
