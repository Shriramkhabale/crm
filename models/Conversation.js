//models/Conversation.js
const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  isGroup: { type: Boolean, default: false },
  name: { type: String }, // group name if isGroup=true
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User ', required: true }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User ', required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Conversation', conversationSchema);
