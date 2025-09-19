const express = require('express');
const router = express.Router();
const ticketReviewController = require('../controllers/ticketReviewController');

// Add or update a review for a ticket
router.post('/', ticketReviewController.addOrUpdateReview);

// Get review by ticket ID
router.get('/:ticketId', ticketReviewController.getReviewByTicket);
router.get('/company/:companyId', ticketReviewController.getReviewsByCompanyId);

module.exports = router;