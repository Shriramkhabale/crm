const express = require('express');
const router = express.Router();
const protect = require('../middleware/protect');
const employeeController = require('../controllers/employeeController');

router.use(protect);

// Create employee
router.post('/', employeeController.createEmployee);

// Get all employees
router.get('/', employeeController.getAllEmployees);

router.get('/:id', employeeController.getEmployeeById);

// Get employees by company
router.get('/company/:companyId', employeeController.getEmployeesByCompany);

// Update employee
router.put('/:id', employeeController.updateEmployee);

// Delete employee
router.delete('/:id', employeeController.deleteEmployee);

module.exports = router;