// routes/employeeRoutes.js
const express = require('express');
const router = express.Router();
const protect = require('../middleware/protect');
const parser = require('../middleware/multerCloudinary');
const employeeController = require('../controllers/employeeController');

router.use(protect);

// Create employee with image upload
router.post(
  '/',
  parser.fields([
    { name: 'adharImage', maxCount: 1 },
    { name: 'panImage', maxCount: 1 },
    { name: 'profileImage', maxCount: 1 }
  ]),
  employeeController.createEmployee
);

// Update employee with image upload
router.put(
  '/:id',
  parser.fields([
    { name: 'adharImage', maxCount: 1 },
    { name: 'panImage', maxCount: 1 },
    { name: 'profileImage', maxCount: 1 }
  ]),
  employeeController.updateEmployee
);


// Get all employees
router.get('/', employeeController.getAllEmployees);

router.get('/:id', employeeController.getEmployeeById);

// Get employees by company
router.get('/company/:companyId', employeeController.getEmployeesByCompany);


// Delete employee
router.delete('/:id', employeeController.deleteEmployee);

module.exports = router;