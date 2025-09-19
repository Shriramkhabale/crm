const mongoose = require('mongoose');

const customerGrpTypeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true }
}, { timestamps: true });

module.exports = mongoose.model('CustomerGrpType', customerGrpTypeSchema);
