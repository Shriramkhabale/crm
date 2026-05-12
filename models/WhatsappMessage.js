const mongoose = require('mongoose');

const whatsappMessageSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  title: { type: String }, // Template Title
  message: { type: String, required: true }, // Message Content
  location: { type: String }, // Location (Optional)
  sequence: { type: Number, default: 0 }, // Order for drag-and-drop templates
  
  // Existing fields for backward compatibility or sent messages
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  followUpId: { type: mongoose.Schema.Types.ObjectId },
  phoneNumber: { type: String },
  status: { type: String },
  sentAt: { type: Date },
  messageType: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('WhatsappMessage', whatsappMessageSchema);
