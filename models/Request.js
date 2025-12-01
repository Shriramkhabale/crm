const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
  subject: { type: String, required: true, trim: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  requestFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  requestTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  requestType: { type: String },
  description: { type: String },
  status: { type: String, default: 'pending' }, // you can customize statuses
  // Legacy fields (kept for backward compatibility)
  image: { type: String },
  audio: { type: String },
  file: { type: String },
  // New attachments array (same as Task model)
  attachments: [
    {
      url: { type: String, required: true },
      type: { type: String, enum: ['image', 'audio', 'file'], required: true },
      originalName: { type: String },
      mimetype: { type: String },
      size: { type: Number }
    }
  ],
  reason: { type: String }, // corrected spelling from "Reson"
  reasonDateTime: { type: Date }, // corrected spelling from "Reson_date_time"
}, { timestamps: true }); // adds createdAt and updatedAt automatically

module.exports = mongoose.model('Request', requestSchema);