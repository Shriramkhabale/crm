const mongoose = require('mongoose');

const ticketReviewSchema = new mongoose.Schema({
  ticketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SupportTicket',
    required: true,
    unique: true, // One review per ticket
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  comment: {
    type: String,
  },
  reviewedAt: {
    type: Date,
    default: Date.now,
  },
  customerId: {
    type: String, // or mongoose.Schema.Types.ObjectId if you have a Customer model
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee', // or your support engineer model name
    required: true,
  },
});

module.exports = mongoose.model('TicketReview', ticketReviewSchema);
