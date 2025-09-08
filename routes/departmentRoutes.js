const express = require('express');
const router = express.Router();
const protect = require('../middleware/protect');
const departmentController = require('../controllers/departmentController');

// Create department for a company
// router.post('/company/:companyId', departmentController.createDepartment);
router.post('/company/:companyId', protect, departmentController.createDepartment);

// Get all departments for a company
router.get('/company/:companyId', departmentController.getDepartmentsByCompany);

// Get one department by ID
router.get('/:id', departmentController.getDepartmentById);

// Update department by ID
router.put('/:id', departmentController.updateDepartment);

// Delete department by ID
router.delete('/:id', departmentController.deleteDepartment);

module.exports = router;
