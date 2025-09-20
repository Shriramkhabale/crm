//models/ProjectMgnt.js

const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  title: { type: String, required: true },
  description: { type: String },
  status: { type: String },
  startDate: { type: Date },
  dueDate: { type: Date },
  budget: { type: Number, min: 0 },
  teamMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }],
  progress: { type: Number, min: 0, max: 100, default: 0 },
  department:[{ type: mongoose.Schema.Types.ObjectId, ref: 'Department' }],
  clientName: { type: String },
  clientCompany: { type: String },
  clientEmail: { type: String, match: /.+\@.+\..+/ },
  clientMobileNo: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('ProjectMgnt', projectSchema);