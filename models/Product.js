// models/Product.js
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  workflow: { type: mongoose.Schema.Types.ObjectId, ref: 'Workflow', required: true },
  // Store custom field values as a flexible object: { fieldName: value, ... }
  customFieldValues: { type: Map, of: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
