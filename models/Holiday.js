const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema({
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
}, { timestamps: true });

holidaySchema.index({ company: 1, date: 1 });  // For range queries

module.exports = mongoose.model('Holiday', holidaySchema);
