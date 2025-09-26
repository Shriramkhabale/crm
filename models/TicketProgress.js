//models/TicketProgress.js

const mongoose = require('mongoose');

const ticketProgressSchema = new mongoose.Schema({
  ticketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SupportTicket',
    required: true,
  },
  status: {
    type: String,
    required: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
  },
  description:{
    type: String,
  },
  reassignDescription: {  // <-- NEW: Separate field for reassignment reasons (optional)
    type: String,
  },
});

module.exports = mongoose.model('TicketProgress', ticketProgressSchema);