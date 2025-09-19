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
    enum: ['monthly', 'quarterly', 'yearly'], // example durations
    required: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  access: {
    task: { type: Boolean, default: false },
    lead: { type: Boolean, default: false },
    hrms: { type: Boolean, default: false },
    support: { type: Boolean, default: false },
    projectManagement: { type: Boolean, default: false },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  }
});

module.exports = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
