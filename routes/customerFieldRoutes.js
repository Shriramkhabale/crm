const express = require('express');
const router = express.Router();
const customerFieldController = require('../controllers/customerFieldController');
const authMiddleware = require('../middleware/authMiddleware'); // Use your auth middleware if needed

// Create a new customer field
router.post('/', authMiddleware, customerFieldController.createCustomerField);

// Get all customer fields
router.get('/', authMiddleware, customerFieldController.getAllCustomerFields);

// Get a customer field by ID
router.get('/:id', authMiddleware, customerFieldController.getCustomerFieldById);

// Update a customer field by ID
router.put('/:id', authMiddleware, customerFieldController.updateCustomerField);

// Delete a customer field by ID
router.delete('/:id', authMiddleware, customerFieldController.deleteCustomerField);

module.exports = router;