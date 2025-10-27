// models/Shift.js
const mongoose = require('mongoose');

const shiftSchema = new mongoose.Schema({
  name: { type: String, required: true },           // e.g., "Morning Shift"
  startTime: { type: String, required: true },      // e.g., "09:00"
  endTime: { type: String, required: true },  
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true } // NEW: Reference to Company

}, { timestamps: true });

module.exports = mongoose.model('Shift', shiftSchema);