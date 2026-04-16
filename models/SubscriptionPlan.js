const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  userLimit: {
    type: Number,
    default: 0,
    min: 0,
  },
  managerLimit: {
    type: Number,
    default: 0,
    min: 0,
  },
  duration: {
    type: String,
    enum: ['7-day', '15-day', 'monthly', 'quarterly', 'yearly', '2-year'],
    required: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  accessPermissions: {
    taskManagement: { type: Boolean, default: false },
    leadManagement: { type: Boolean, default: false },
    hrms: { type: Boolean, default: false },
    support: { type: Boolean, default: false },
    projectManagement: { type: Boolean, default: false },
  },
  userLimits: {
    taskManagement: { type: Number, default: 0 },
    leadManagement: { type: Number, default: 0 },
    hrms: { type: Number, default: 0 },
    support: { type: Number, default: 0 },
    projectManagement: { type: Number, default: 0 },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  }
});

module.exports = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);