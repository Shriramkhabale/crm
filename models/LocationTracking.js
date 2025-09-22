const mongoose = require('mongoose');

const locationPointSchema = new mongoose.Schema({
  latitude: { type: Number, required: true },  // GPS latitude
  longitude: { type: Number, required: true }, // GPS longitude
  timestamp: { type: Date, required: true },   // When the point was captured
  speed: { type: Number },                     // Optional: Speed in km/h (from GPS)
  accuracy: { type: Number },                  // Optional: GPS accuracy in meters
  batteryLevel: { type: Number },              // Optional: Device battery % at capture
  // Optional: Reference to a task or route if linked to field work
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' }
});

const locationTrackingSchema = new mongoose.Schema({
  employee: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Employee', 
    required: true 
  },  // Who is being tracked (support engineer)
  company: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Company', 
    required: true 
  },  // Company reference
  routeId: { type: String, required: true },   // Unique ID for the route/session (e.g., "route-2024-01-15-001")
  locations: [locationPointSchema],            // Array of location points (batch)
  startTime: { type: Date, required: true },   // When the route/batch started
  endTime: { type: Date, required: true },     // When the batch was submitted
  totalPoints: { type: Number, required: true }, // Number of location points in this batch
  status: { 
    type: String, 
    enum: ['active', 'completed', 'paused'], 
    default: 'active' 
  },  // Route status
  notes: { type: String },                     // Optional: Any notes from the engineer
}, { 
  timestamps: true  // Adds createdAt/updatedAt
});

// Index for efficient querying by employee/company/route
locationTrackingSchema.index({ employee: 1, company: 1 });
locationTrackingSchema.index({ routeId: 1 });
locationTrackingSchema.index({ startTime: -1 });

module.exports = mongoose.model('LocationTracking', locationTrackingSchema);
