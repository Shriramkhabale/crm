const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/companyDashboardController');
const authMiddleware = require('../middleware/authMiddleware'); // or 'protect'

// Protect all routes with authentication middleware
router.use(authMiddleware);

// Total employees count
router.get('/employees/count', dashboardController.getTotalEmployees);

// Total projects count
router.get('/projects/count', dashboardController.getTotalProjects);

// Tasks count grouped by status
router.get('/tasks/status', dashboardController.getTasksByStatus);

// Total support tickets count
router.get('/tickets/count', dashboardController.getTotalTickets);

// Today's present employees count
router.get('/attendance/present-today', dashboardController.getTodaysPresentEmployees);

// Bonus: Tasks created per day for last 7 days
router.get('/tasks/last7days', dashboardController.getTasksLast7Days);

module.exports = router;
