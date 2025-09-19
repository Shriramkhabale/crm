const mongoose = require('mongoose');

const productFieldSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true }, // add company reference
  fieldName: { type: String, required: true, unique: true }, // name of the field
  dataType: { 
    type: String
  },
  isRequired: { type: Boolean, default: false },
  showTable: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('ProductField', productFieldSchema);