//models/Message.js

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User ', required: true },
  content: { type: String, required: true }, // text or URL to media
  type: { type: String, enum: ['text', 'image', 'video', 'file'], default: 'text' },
  createdAt: { type: Date, default: Date.now },
  deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User ' }], // users who deleted this message for themselves
  deletedForAll: { type: Boolean, default: false } // if true, message deleted for everyone 
});

module.exports = mongoose.model('Message', messageSchema);