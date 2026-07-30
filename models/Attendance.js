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
  // NEW: For multiple punches in a day
  punches: [{
    inTime: { type: Date },
    inLocation: { type: String },
    inPhoto: { type: String },
    outTime: { type: Date },
    outLocation: { type: String },
    outPhoto: { type: String },
    // Auto punch-out audit fields (per session)
    isAutoPunchOut: { type: Boolean, default: false },
    punchOutSource: { type: String },          // e.g. "AUTO_MIDNIGHT" or "MANUAL"
    outPhotoMissingReason: { type: String },   // e.g. "AUTO_PUNCH_OUT"
  }],
  // NEW: For leave-linked attendance
  leaveType: { type: String },
  leaveRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'Leave' },  

  // NEW: Automatic Punch Out fields
  isAutoPunchOut: { type: Boolean, default: false },
  punchOutSource: { type: String },
  locationFile: { type: String },
  locationFileUrl: { type: String },
  locationUrl: { type: String },
  locationsLink: { type: String },
  attendanceLink: { type: String },
  cloudinaryLink: { type: String },
  autoPunchOut: { type: Boolean, default: false },
  punchOutType: { type: String },
  outPhotoMissingReason: { type: String },
}, { timestamps: true });

// Indexes for efficient queries (unique by company/employee/date, and leave-linked)
attendanceSchema.index({ company: 1, employee: 1, date: 1 }, { unique: true });
attendanceSchema.index({ leaveRequestId: 1 });
attendanceSchema.index({ employee: 1, leaveType: 1, date: 1 });
module.exports = mongoose.model('Attendance', attendanceSchema);