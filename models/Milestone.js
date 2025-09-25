//models/Milstone.js
const mongoose = require('mongoose');

const milestoneSchema = new mongoose.Schema({
  title: { type: String, required: true },
  projectName: { type: String, required: true },  // projectmgnt id
  dueDate: { type: Date, required: true },
  status: { 
    type: String
  },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Milestone', milestoneSchema);