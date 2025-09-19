const express = require('express');
const router = express.Router();
const branchController = require('../controllers/branchController');
const authMiddleware = require('../middleware/authMiddleware'); // if you have auth

// Create branch
router.post('/', authMiddleware, branchController.createBranch);

// Get all branches for a company
router.get('/company/:companyId', authMiddleware, branchController.getBranchesByCompany);

// Get branch by ID
router.get('/:id', authMiddleware, branchController.getBranchById);

// Update branch
router.put('/:id', authMiddleware, branchController.updateBranch);

// Delete branch
router.delete('/:id', authMiddleware, branchController.deleteBranch);

module.exports = router;