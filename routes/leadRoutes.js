//routes/leadRoutes.js
const express = require('express');
const router = express.Router();
const leadController = require('../controllers/leadController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/', authMiddleware, leadController.createLead);
router.get('/', authMiddleware, leadController.getAllLeads);
router.get('/:id', authMiddleware, leadController.getLeadById);
router.put('/:id', authMiddleware, leadController.updateLead);
router.delete('/:id', authMiddleware, leadController.deleteLead);

module.exports = router;

