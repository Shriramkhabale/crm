const express = require('express');
const router = express.Router();
const subscriptionPlanController = require('../controllers/subscriptionPlanController');
const authMiddleware = require('../middleware/authMiddleware'); 

// Create subscription plan
router.post('/', authMiddleware, subscriptionPlanController.createPlan);

// Get all subscription plans
router.get('/', authMiddleware, subscriptionPlanController.getAllPlans);

// Get subscription plan by ID
router.get('/:id', authMiddleware, subscriptionPlanController.getPlanById);

// Update subscription plan
router.put('/:id', authMiddleware, subscriptionPlanController.updatePlan);

// Delete subscription plan
router.delete('/:id', authMiddleware, subscriptionPlanController.deletePlan);

module.exports = router;