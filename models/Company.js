//models/Company.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const companySchema = new mongoose.Schema({
  superadmin: { type: mongoose.Schema.Types.ObjectId, ref: 'Superadmin' },
  franchise: { type: mongoose.Schema.Types.ObjectId, ref: 'Franchise' },
  businessName: { type: String, required: true },
  businessEmail: { type: String, required: true, unique: true, lowercase: true },
  businessPhone: { type: String },
  EmergencyMobNo: { type: String },
  password: { type: String, required: true },
  businessCreatedDate: { type: Date },
  businessSubscriptionPlan: { type: String },
  weeklyHoliday: { type: [String] },
  address: { type: String },
  isBranch: { type: Boolean, default: false },
  parentCompanyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },
  branches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Company' }] ,
  businessLogo: { type: String },
}, { timestamps: true });

// Hash password before saving
companySchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('Company', companySchema);