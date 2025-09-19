//models/Lead.js
const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  workflow: { type: mongoose.Schema.Types.ObjectId, ref: 'Workflow', required: true },
  stage: { type: String}, // or ObjectId if stages are separate collection
  title: { type: String, required: true },
  description: { type: String },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' }, // optional
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  department: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Department' }],
  teamMember: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }], // optional
  amount: { type: Number },
  endDate: { type: Date },
  location: { type: String },
  source: { type: String },
  images: [{ type: String }], 
  audioRecording: { type: String }, 
  documentUpload: { type: String },
  sendWhatsappNotification: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Lead', leadSchema);
