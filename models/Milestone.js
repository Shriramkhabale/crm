//models/Milstone.js

const mongoose = require('mongoose');

const milestoneSchema = new mongoose.Schema({
  title: { type: String, required: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'ProjectMgnt', required: true },  // CHANGED: Ref to ProjectMgnt (was projectName: String)
  description: { type: String },  // NEW: Description
  dueDate: { type: Date, required: true },
  status: { type: String },  // e.g., "Pending", "In Progress", "Completed"
assignedTeamMember: [
    { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' } // ✅ multiple members
  ],  nextFollowUp: { type: Date },  // NEW: Next follow-up date-time (ISO)
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true }
}, { timestamps: true });

// Index for efficient queries
milestoneSchema.index({ company: 1, project: 1 });
milestoneSchema.index({ dueDate: 1 });

module.exports = mongoose.model('Milestone', milestoneSchema);  // Note: "Milstone" → "Milestone" for consistency
