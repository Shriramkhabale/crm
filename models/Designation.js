const mongoose = require('mongoose');

const designationSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g., "Manager", "Developer", "HR"
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true }, 
}, { timestamps: true });

// Optional: unique designation name per company + department
designationSchema.index({ name: 1, company: 1, department: 1 }, { unique: true });

module.exports = mongoose.model('Designation', designationSchema);
