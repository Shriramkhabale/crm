//models/LocationTracking.js
const mongoose = require('mongoose');

const locationPointSchema = new mongoose.Schema({
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  timestamp: { type: Date, required: true },
  speed: { type: Number },
  accuracy: { type: Number },
  batteryLevel: { type: Number },
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' }  // Per-point task (optional)
});

const locationTrackingSchema = new mongoose.Schema({
  employee: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Employee', 
    required: true 
  },
  company: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Company', 
    required: true 
  },
  taskId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Task',
    required: false  // Optional; if omitted, it's general employee tracking
  },
  locations: [locationPointSchema],  // Array grows with appends
  startTime: { type: Date, required: true },  // Task/route start
  endTime: { type: Date, required: true },    // Updated on each append
  totalPoints: { type: Number, required: true },  // Cumulative
  status: { 
    type: String, 
    enum: ['active', 'completed', 'paused'], 
    default: 'active' 
  },
  notes: { type: String },  // Updated on appends
}, { 
  timestamps: true 
});

// Indexes for efficient querying (now by taskId + employee + company)
locationTrackingSchema.index({ employee: 1, company: 1, taskId: 1 });  // Unique combo for appending
locationTrackingSchema.index({ taskId: 1 });
locationTrackingSchema.index({ employee: 1 });
locationTrackingSchema.index({ startTime: -1 });

module.exports = mongoose.model('LocationTracking', locationTrackingSchema);
