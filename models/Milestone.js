//models/Milstone.js

const mongoose = require('mongoose');

// models/Milestone.js - UPDATE THIS
// models/Milestone.js - UPDATED STRUCTURE
// models/Milestone.js - ADD THESE FIELDS
const milestoneSchema = new mongoose.Schema({
  title: { type: String, required: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'ProjectMgnt', required: true },
  description: [{ type: String }],
  dueDate: { type: Date, required: true },
  status: { type: String },

  statusHistory: [{
    status: { type: String, required: true },
    description: [{ type: String }],
    updatedAt: { type: Date, default: Date.now },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    // ✅ ADDED: File fields for history tracking
    images: [{ type: String }],
    audios: [{ type: String }],
    files: [{ type: String }],
    attachmentUrls: [{ type: String }]
  }],

  assignedTeamMember: [
    { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }
  ],
  nextFollowUp: { type: Date },

  // ✅ ADD THESE FIELDS FOR MEDIA/FILES
  images: [{ type: String }],        // Array of image URLs
  audios: [{ type: String }],        // Array of audio URLs  
  files: [{ type: String }],         // Array of file URLs
  attachmentUrls: [{ type: String }], // Alternative field for attachments

  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true }
}, { timestamps: true });

milestoneSchema.index({ company: 1, project: 1 });
milestoneSchema.index({ dueDate: 1 });

module.exports = mongoose.model('Milestone', milestoneSchema);

// Index for efficient queries
milestoneSchema.index({ company: 1, project: 1 });
milestoneSchema.index({ dueDate: 1 });

module.exports = mongoose.model('Milestone', milestoneSchema);  // Note: "Milstone" → "Milestone" for consistency
