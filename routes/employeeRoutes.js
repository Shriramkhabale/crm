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
    { name: 'profileImage', maxCount: 1 },
    { name: 'documents', maxCount: 10 }  // NEW: Dynamic docs (up to 10 files)
  ]),
  employeeController.createEmployee
);

// Update employee with image upload
router.put(
  '/:id',
  parser.fields([
    { name: 'adharImage', maxCount: 1 },
    { name: 'panImage', maxCount: 1 },
    { name: 'profileImage', maxCount: 1 },
    { name: 'documents', maxCount: 10 }  // NEW: Dynamic docs (up to 10 files)

  ]),
  employeeController.updateEmployee
);

// NEW: Get all documents (fixed + dynamic) for an employee
router.get('/:id/documents', employeeController.getEmployeeDocuments);

// Get all employees
router.get('/', employeeController.getAllEmployees);

router.get('/:id', employeeController.getEmployeeById);

// Get employees by company
router.get('/company/:companyId', employeeController.getEmployeesByCompany);


// Delete employee
router.delete('/:id', employeeController.deleteEmployee);

module.exports = router;