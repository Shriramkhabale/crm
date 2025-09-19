// models/task.js
const mongoose = require('mongoose');
require('../models/Employee');  // adjust path as needed
const taskSchema = new mongoose.Schema({
  title: { type: String},
  description: String,
  department: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Department' }], 
  assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }],
  startDateTime: { type: Date },
  endDateTime: { type: Date},
  status: { type: String},
  repeat: { type: Boolean, default: false },
  repeatFrequency: { type: String, enum: ['daily', 'weekly', 'monthly'] },
  repeatDaysOfWeek: [{ type: String, enum: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] }],
  // For monthly repeat: array of dates (1-31)
  repeatDatesOfMonth: [{ type: Number, min: 1, max: 31 }],
  creditPoints: { type: Number, default: 0 },

  priority: { type: String, default: 'medium' },
  // If repeat is false, nextFollowUpDateTime is used
  nextFollowUpDateTime: { type: Date},
  images: [{ type: String }],  // array of image URLs
  audios: [{ type: String }],  // array of audio URLs
  files: [{ type: String }], 

  // If repeat is true, nextFinishDateTime is used
  nextFinishDateTime: { type: Date },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },

}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);