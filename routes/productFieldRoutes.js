const express = require('express');
const router = express.Router();
const productFieldController = require('../controllers/productFieldController');
const authMiddleware = require('../middleware/authMiddleware'); // Use your auth middleware if needed

// Create a new product field
router.post('/', authMiddleware, productFieldController.createProductField);

// Get all product fields
router.get('/', authMiddleware, productFieldController.getAllProductFields);

// Get a product field by ID
router.get('/:id', authMiddleware, productFieldController.getProductFieldById);

// Update a product field by ID
router.put('/:id', authMiddleware, productFieldController.updateProductField);

// Delete a product field by ID
router.delete('/:id', authMiddleware, productFieldController.deleteProductField);

module.exports = router;