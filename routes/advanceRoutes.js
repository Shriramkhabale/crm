//routes/advanceRoutes.js
const express = require('express');
const router = express.Router();
const { 
  createAdvance, 
  getAdvancesByEmployee, 
  getCompanyAdvances 
} = require('../controllers/advanceController');
const authMiddleware = require('../middleware/authMiddleware');


// POST /api/advances - Create a new salary advance (employee/admin creates for self or others? Based on controller, for self)
router.post('/', authMiddleware, createAdvance);

// GET /api/advances/employee/:employeeId - Get advances for a specific employee (self or admin view)
router.get('/employee/:employeeId', authMiddleware, getAdvancesByEmployee);

// GET /api/advances/company - Get all advances for the company (admin view, optional filters via query params)
router.get('/company', authMiddleware, getCompanyAdvances);  // Optional: Add isAdmin middleware here if needed

module.exports = router;