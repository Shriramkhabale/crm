const express = require('express');
const router = express.Router();
const leaveController = require('../controllers/leaveController');
const authMiddleware = require('../middleware/authMiddleware'); // if you have auth

router.post('/', authMiddleware, leaveController.createLeave);
router.get('/', authMiddleware, leaveController.getLeaves);
router.get('/:id', authMiddleware, leaveController.getLeaveById);
router.put('/:id/status', authMiddleware, leaveController.updateLeaveStatus);
router.delete('/:id', authMiddleware, leaveController.deleteLeave);
router.patch('/:id', authMiddleware, leaveController.updateLeave);

router.get('/employee/:employeeId/summary', authMiddleware, leaveController.getEmployeeLeavesSummary);


module.exports = router;