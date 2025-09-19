const express = require('express');
const router = express.Router();
const milestoneController = require('../controllers/milestoneController');
const authMiddleware = require('../middleware/authMiddleware'); // if you have auth

router.post('/', authMiddleware, milestoneController.createMilestone);
router.get('/', authMiddleware, milestoneController.getMilestones);
router.get('/:id', authMiddleware, milestoneController.getMilestoneById);
router.put('/:id', authMiddleware, milestoneController.updateMilestone);
router.delete('/:id', authMiddleware, milestoneController.deleteMilestone);

module.exports = router;
