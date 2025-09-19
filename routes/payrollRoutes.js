// routes/payrollRoutes.js
const express = require('express');
const router = express.Router();
const payrollController = require('../controllers/payrollController');
const protect = require('../middleware/protect'); // your auth middleware

// Protect all payroll routes
router.use(protect);

// Generate payroll for employee
router.post('/generate', payrollController.generatePayroll);

// Optional: Get payroll by employee and month
router.get('/:employeeId/year/:year/month/:month', payrollController.getPayrollByEmployeeAndMonth);

module.exports = router;