//models/TaskStatusUpdate.js

const mongoose = require('mongoose');

const taskStatusUpdateSchema = new mongoose.Schema({
  task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
  status: { type: String, required: true },
  description: { type: String },
  givenCreditPoints:{type: String},
  image: { type: String }, 
  file: { type: String }, 
  audio: { type: String },
  nextFollowUpDateTime: { type: Date }, 
  updatedAt: { type: Date, default: Date.now },
  shiftedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }, // who reassigned
  oldAssigneeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
});

module.exports = mongoose.model('TaskStatusUpdate', taskStatusUpdateSchema);