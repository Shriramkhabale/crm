const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  message: { type: String, required: true },
  image: { type: String },
  audio: { type: String },
  file: { type: String },
  viewedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }], // users who viewed this message
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Message || mongoose.model('Message', messageSchema);
