const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ['task', 'ticket', 'lead', 'project', 'milestone'],
      required: true
    },
    title: {
      type: String
    },
    message: {
      type: String,
      required: true
    },
    relatedId: {
      type: mongoose.Schema.Types.ObjectId
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true
    },
    meta: {
      // Optional metadata such as assignedBy, priority, etc.
      assignedBy: { type: mongoose.Schema.Types.ObjectId },
      assignedByName: { type: String },
      priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'] },
      companyId: { type: mongoose.Schema.Types.ObjectId },
      companyName: { type: String }
    }
  },
  { timestamps: true }
);

NotificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', NotificationSchema);

