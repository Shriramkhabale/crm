const messageViewStatusSchema = new mongoose.Schema({
  message: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User ', required: true },
  viewedAt: { type: Date, default: Date.now }
});

messageViewStatusSchema.index({ message: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('MessageViewStatus', messageViewStatusSchema);