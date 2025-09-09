const mongoose = require('mongoose');

const stageSchema = new mongoose.Schema({
  openstage: { type: String, required: true },   
  colorTheme: { type: String, required: true },  
});

const workflowSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },  // workflow name
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true }, // company at workflow level
  openStages: [stageSchema],  
  closeStages: [stageSchema],

}, { timestamps: true });

module.exports = mongoose.model('Workflow', workflowSchema);