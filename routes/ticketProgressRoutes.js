const express = require('express');
const router = express.Router();
const ticketProgressController = require('../controllers/ticketProgressController');

// Add a progress update and update ticket status
router.post('/', ticketProgressController.addProgressUpdate);

// Get all progress updates for a ticket
router.get('/:ticketId', ticketProgressController.getProgressByTicket);

module.exports = router;
