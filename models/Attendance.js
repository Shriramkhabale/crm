//models/Attendance.js
const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  date: { type: Date, required: true },
  inTime: { type: Date, required: true },
  inLocation: { type: String }, 
  inPhoto: { type: String },
  outTime: { type: Date },
  outLocation: { type: String },
  outPhoto: { type: String },
  workingTime: { type: Number }, 
  status: { type: String },
   // NEW: For leave-linked attendance
  leaveType: { type: String },
  leaveRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'Leave' },  

}, { timestamps: true });

// Indexes for efficient queries (unique by company/employee/date, and leave-linked)
attendanceSchema.index({ company: 1, employee: 1, date: 1 }, { unique: true });
attendanceSchema.index({ leaveRequestId: 1 });
attendanceSchema.index({ employee: 1, leaveType: 1, date: 1 });
module.exports = mongoose.model('Attendance', attendanceSchema);