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
  // NEW: Project head (one from teamMembers)
  projectHead: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  // NEW: Client details
  clientName: { type: String },
  clientCompany: { type: String },
  clientEmail: { type: String, match: /.+\@.+\..+/ },
  clientMobileNo: { type: String },
  clientAddress: { type: String },  // NEW: Client address
  clientCity: { type: String },     // NEW: Client city
  clientState: { type: String },    // NEW: Client state
  // NEW: Dynamic custom fields (key-value pairs)
  customFields: [{
    key: { type: String, required: true, trim: true, minlength: 1 },  // e.g., "Priority", "Risk Level"
    value: { type: String, required: true }  // e.g., "High", "Medium Risk"
  }]
}, { timestamps: true });

// NEW: Ensure unique keys in customFields (custom validator)
projectSchema.path('customFields.key').validate(function(keys) {
  if (!Array.isArray(keys)) return true;
  const uniqueKeys = [...new Set(keys.map(field => field.key.toLowerCase()))];
  return uniqueKeys.length === keys.length;  // No duplicates
}, 'Duplicate custom field keys not allowed');

module.exports = mongoose.model('ProjectMgnt', projectSchema);
