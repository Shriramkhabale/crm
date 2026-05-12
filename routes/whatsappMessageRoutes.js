const express = require('express');
const router = express.Router();
const protect = require('../middleware/protect');
const whatsappMessageController = require('../controllers/whatsappMessageController');

// Create a new WhatsApp message template
router.post('/company/:companyId', protect, whatsappMessageController.createTemplate);

// Get all WhatsApp message templates for a company
router.get('/company/:companyId', protect, whatsappMessageController.getTemplatesByCompany);

// Reorder templates for a company (drag-and-drop order)
router.put('/reorder/company/:companyId', protect, whatsappMessageController.reorderTemplates);

// Update a template by ID
router.put('/:id', protect, whatsappMessageController.updateTemplate);

// Delete a template by ID
router.delete('/:id', protect, whatsappMessageController.deleteTemplate);

module.exports = router;
