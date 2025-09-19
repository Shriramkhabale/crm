const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  whatsappNumber: { type: String, required: true },
  alternativeMobileNumber: { type: String },
  email: { type: String },
  city: { type: String },
  groupType: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerGrpType' },
  address: { type: String },
  customFields: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

module.exports = mongoose.model('Customer', customerSchema);
