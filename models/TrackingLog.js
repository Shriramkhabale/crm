const mongoose = require('mongoose');

const trackingLogSchema = new mongoose.Schema({
  employeeId: { type: String, required: true },
  companyId:  { type: String, required: true },
  date:       { type: String, required: true }, // "YYYY-MM-DD"
  event:      { type: String, required: true }, // e.g., "punch-in", "punch-out"
  timestamp:  { type: Number, required: true },
  createdAt:  { type: Date, default: Date.now }
});

trackingLogSchema.index({ employeeId: 1, date: 1 });

module.exports = mongoose.model('TrackingLog', trackingLogSchema);
