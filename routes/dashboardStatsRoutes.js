const express = require('express');
const router = express.Router();
const controller = require('../controllers/dashboardStatsController');

// These routes match the calls in App.js
router.get('/notifications', controller.getNotifications);
router.get('/employees/count', controller.getEmployeeCount);
router.get('/tasks/stats', controller.getTaskStats);
router.get('/projects/count', controller.getProjectCount);
router.get('/tickets/count', controller.getTicketCount);

module.exports = router;
