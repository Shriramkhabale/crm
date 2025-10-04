// models/Task.js
const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  department: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Department' }], 
  assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true }],
  startDateTime: { type: Date, required: true },
  endDateTime: { type: Date, required: true },
  status: { type: String, enum: ['pending', 'in-progress', 'completed', 'overdue', 'reassigned'], default: 'pending' },
  repeat: { type: Boolean, default: false },
  repeatFrequency: { type: String, enum: ['daily', 'weekly', 'monthly'] },
  repeatDaysOfWeek: [{ type: String, enum: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] }],  // Multi-select
  repeatDatesOfMonth: [{ type: Number, min: 1, max: 31 }], 
  creditPoints: { type: Number, default: 0 },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  nextFollowUpDateTime: { type: Date }, 
  nextFinishDateTime: { type: Date },
  images: [{ type: String }],  
  audios: [{ type: String }],  
  files: [{ type: String }], 
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  parentTask: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' }, 
  isRecurringInstance: { type: Boolean, default: false },  
  recurrenceActive: { type: Boolean, default: true }, 
}, { timestamps: true });

// Virtual for overdue (only for non-repeat or daily children: >1 day past endDateTime)
taskSchema.virtual('isOverdue').get(function() {
  if (this.repeat || this.parentTask) return false;  // Handled in queries for children
  const oneDayMs = 24 * 60 * 60 * 1000;
  return this.endDateTime < new Date(Date.now() - oneDayMs) && this.status !== 'completed';
});

// Include virtuals in JSON
taskSchema.set('toJSON', { virtuals: true });
taskSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Task', taskSchema);
