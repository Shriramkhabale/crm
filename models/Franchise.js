const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const franchiseSchema = new mongoose.Schema({
  superadmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Superadmin ',
    required: true,
  },
  franchiseName: { type: String, required: true },  
  franchisePhone: { type: String, required: true, unique: true },
  franchiseEmail: { type: String, required: true},
  password: { type: String, required: true},
  createdDate: { type: String },
  address: { type: String },
  userlimit: { type: String },
  planPrice: { type: String },
  duration: { type: String },
  startDate: { type: String },
  endDate: { type: String },
  franchiseLogo: { type: String },  
  // New fields for password reset
  resetPasswordToken: {
    type: String,  // Hashed token
  },
  resetPasswordExpires: {
    type: Date,  // Expiration timestamp
  },

}, { timestamps: true });

// Hash password before saving
franchiseSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});
module.exports = mongoose.model('Franchise', franchiseSchema);