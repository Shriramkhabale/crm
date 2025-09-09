const mongoose = require('mongoose');

const stageSchema = new mongoose.Schema({
  openstage: { type: String, required: true },   // stage name or label
  colorTheme: { type: String, required: true },  // color code or theme name
});

const workflowSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },  // workflow name
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true }, // company at workflow level
  openStages: [stageSchema],   // array of open stages
  closeStages: [stageSchema],  // array of close stages

}, { timestamps: true });

module.exports = mongoose.model('Workflow', workflowSchema);
