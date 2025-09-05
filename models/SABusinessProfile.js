// SABusinessProfile.js
const mongoose = require('mongoose');

const businessProfileSchema = new mongoose.Schema({
  superadmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true // one business profile per superadmin
  },
  businessLogo: {type: String}, // You can store the image URL or base64
  businessName: {type: String, required:true}, // You can store the image URL or base64
  businessType: { type: String },
  registrationType: { type: String },
  businessMobileNumber: { type: String },
  businessEmail: { type: String },
  gstNumber: { type: String },
  panNumber: { type: String },
  pinCode: { type: String },
  state: { type: String },
  stateCode: { type: String },
  city: { type: String },
  businessAddress: { type: String },
}, {
  timestamps: true
});

module.exports = mongoose.model('BusinessProfile', businessProfileSchema);