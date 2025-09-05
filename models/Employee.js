//models/Employee.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const employeeSchema = new mongoose.Schema({
  company: { type: String, required: true }, // or ObjectId ref if you have Company collection
  teamMemberName: { type: String, required: true },  
  mobileNumber: { type: String, required: true },    // Mobile Number *
  emergencyMobileNumber: { type: String },            // Emergency Mob no
  email: { type: String, required: true, unique: true }, // Email Address *
  password: { type: String, required: true },
  salary: { type: String },                            // Salary *
  dateOfJoining: { type: Date },                       // Date of Joining
  shift: { type: String },                             // Shift (dynamic dropdown)
  department: { type: String, required: true },       // Department (dynamic dropdown)
  role: {type: String},
  aadharNumber: { type: String },                       // Aadhar Number
  panNumber: { type: String },                          // Pan Number
  userUpi: { type: String },                            // User Upi
  weeklyHoliday: [{
    type: String,
    enum: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  }],                                                   // Weekly Holiday
  address: { type: String },                           // Leave-Type
  accessPermissions: {                                  // User Access (pages/modules user can handle)
    type: [String],
    default: [],
  },
  adharImage: { type: String },                         // Adhar Image URL or path
  panImage: { type: String },                           // Pan Image URL or path
  profileImage: { type: String }, 
  qrCode: { type: String }, 
}, { timestamps: true });

// Hash password before saving
employeeSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('Employee', employeeSchema);