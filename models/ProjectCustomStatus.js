const mongoose = require('mongoose');

const projectCustomStatusSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  name: { 
    type: String, 
    required: true, 
    trim: true, 
    minlength: 1
  }
}, { timestamps: true });


projectCustomStatusSchema.index({ company: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('ProjectStatus', projectCustomStatusSchema);  