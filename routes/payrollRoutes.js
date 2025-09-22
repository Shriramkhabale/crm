const express = require('express');
const router = express.Router();
const payrollController = require('../controllers/payrollController');
const protect = require('../middleware/protect'); // Your auth middleware (sets req.user)

// Protect all payroll routes
router.use(protect);

// Generate payroll for selected employee (user fills deductions/incomes in body)
router.post('/generate', payrollController.generatePayroll);

// Get payroll slip by employee and month/year
router.get('/:employeeId/year/:year/month/:month', payrollController.getPayrollByEmployeeAndMonth);

// Optional: Get all payroll for company (for admin dashboard)
router.get('/', payrollController.getCompanyPayrollHistory);

module.exports = router;
