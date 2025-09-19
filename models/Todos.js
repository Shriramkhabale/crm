// todos.js
const mongoose = require('mongoose');

const todoSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: String,
  status: {type: String},
  dueDate: Date,
}, { timestamps: true });

module.exports = mongoose.model('Todos', todoSchema);