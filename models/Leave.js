const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  reason: { type: String, required: true },
  rejectionReason: { type: String },
  fromDate: { type: Date, required: true },
  toDate: { type: Date, required: true },
  status: { type: String, default: 'Pending' },  // Pending, Approved, Partially Approved, Rejected
  leaveType: { type: String },
  approvedDates: [{ type: Date }],  // NEW: Array of approved dates (for partial approval)
  appliedDate: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Leave', leaveSchema);
