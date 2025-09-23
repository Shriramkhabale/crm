const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');  // Your auth
const SuperAdminController = require('../controllers/superadminDashboardController');

// Apply auth + superadmin check to all routes
router.use(authMiddleware);

// Companies
router.get('/companies', SuperAdminController.getAllCompanies);

// Franchises
router.get('/franchises', SuperAdminController.getAllFranchises);

// Employees
router.get('/employees', SuperAdminController.getAllEmployees);

// Graph: Monthly registrations
router.get('/monthly-registrations', SuperAdminController.getMonthlyCompanyRegistrations);

// Subscriptions
router.get('/subscriptions', SuperAdminController.getCompanySubscriptions);

module.exports = router;