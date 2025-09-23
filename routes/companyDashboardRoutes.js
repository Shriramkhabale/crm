const express = require('express');
const router = express.Router();
const { 
  getEmployees, 
  getTasks, 
  getSupportTickets, 
  getBranches 
} = require('../controllers/companyDashboardController');

// Assume you have an auth middleware (e.g., verifies JWT and sets req.user)
const authMiddleware = require('../middleware/authMiddleware');  // Your auth

// Routes (all protected by auth)
router.get('/employees', authMiddleware, getEmployees);
router.get('/tasks', authMiddleware, getSupportTickets);
router.get('/support-tickets', authMiddleware, getSupportTickets);
router.get('/branches', authMiddleware, getBranches);

module.exports = router;
