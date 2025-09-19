const mongoose = require('mongoose');

const customerFieldSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true }, 
  fieldName: { type: String, required: true, unique: true },
  dataType: { 
    type: String
  },
  isRequired: { type: Boolean, default: false },
  showTable: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('CustomerField', customerFieldSchema);