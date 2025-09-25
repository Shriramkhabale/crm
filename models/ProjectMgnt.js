const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  title: { type: String, required: true },
  description: { type: String },
  status: { type: String },
  startDate: { type: Date },
  dueDate: { type: Date },
  budget: { type: Number, min: 0 },
  teamMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }],
  progress: { type: Number, min: 0, max: 100, default: 0 },
  department: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Department' }],
  projectHead: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  clientName: { type: String },
  clientCompany: { type: String },
  clientEmail: { type: String, match: /.+\@.+\..+/ },
  clientMobileNo: { type: String },
  clientAddress: { type: String }, 
  clientCity: { type: String },   
  clientState: { type: String },    
  customFields: [{
    key: { type: String, required: true, trim: true, minlength: 1 },  
    value: { type: String, required: true } 
  }]
}, { timestamps: true });

// NEW: Ensure unique keys in customFields (custom validator)
projectSchema.path('customFields.key').validate(function(keys) {
  if (!Array.isArray(keys)) return true;
  const uniqueKeys = [...new Set(keys.map(field => field.key.toLowerCase()))];
  return uniqueKeys.length === keys.length;  
}, 'Duplicate custom field keys not allowed');

module.exports = mongoose.model('ProjectMgnt', projectSchema);
