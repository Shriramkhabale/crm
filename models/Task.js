// models/task.js
const mongoose = require('mongoose');
require('../models/Employee');  // adjust path as needed
const taskSchema = new mongoose.Schema({
  title: { type: String},
  description: String,
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' }, // or ObjectId if you have Department collection
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  startDateTime: { type: Date },
  endDateTime: { type: Date},

  repeat: { type: Boolean, default: false },
  repeatFrequency: { type: String, enum: ['daily', 'weekly', 'monthly'], required: function() { return this.repeat; } },

  // For weekly repeat: array of weekdays (e.g., ['Monday', 'Wednesday'])
  repeatDaysOfWeek: [{ type: String, enum: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] }],

  // For monthly repeat: array of dates (1-31)
  repeatDatesOfMonth: [{ type: Number, min: 1, max: 31 }],

  priority: { type: String, default: 'medium' },

  // If repeat is false, nextFollowUpDateTime is used
  nextFollowUpDateTime: { type: Date, required: function() { return !this.repeat; } },

  // If repeat is true, nextFinishDateTime is used
  nextFinishDateTime: { type: Date, required: function() { return this.repeat; } },

  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },

}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);
