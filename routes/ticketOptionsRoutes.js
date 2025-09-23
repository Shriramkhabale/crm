const express = require('express');
const router = express.Router();
const ticketOptionsController = require('../controllers/ticketOptionsController');
const authMiddleware = require('../middleware/authMiddleware');

// POST: Add option to category
router.post('/add', authMiddleware, ticketOptionsController.addTicketOption);

// GET: Fetch all options
router.get('/', authMiddleware, ticketOptionsController.getTicketOptions);

module.exports = router;