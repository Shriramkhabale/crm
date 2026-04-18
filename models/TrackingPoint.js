const mongoose = require('mongoose');

const trackingPointSchema = new mongoose.Schema({
  employeeId: { type: String, required: true },
  companyId:  { type: String, required: true },
  date:       { type: String, required: true }, // "YYYY-MM-DD"
  latitude:   { type: Number, required: true },
  longitude:  { type: Number, required: true },
  accuracy:   { type: Number },
  speed:      { type: Number },
  timestamp:  { type: Number, required: true },
  createdAt:  { type: Date, default: Date.now }
});

// Index for performance: { employeeId, date }
trackingPointSchema.index({ employeeId: 1, date: 1 });

module.exports = mongoose.model('TrackingPoint', trackingPointSchema);
