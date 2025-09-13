const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true }], // 2 or more users
  lastMessage: { type: String },
  lastMessageAt: { type: Date },
  deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }], // users who deleted this conversation
}, { timestamps: true });

module.exports = mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema);
