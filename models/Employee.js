const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const employeeSchema = new mongoose.Schema({
  company: { type: String, required: true }, 
  teamMemberName: { type: String, required: true },  
  isActive:{type: Boolean, default: true},
  mobileNumber: { type: String, required: true },    
  emergencyMobileNumber: { type: String },            
  email: { type: String, required: true, unique: true }, 
  password: { type: String, required: true },
  salary: { type: String },                           
  dateOfJoining: { type: Date },                       
  shift: { type: String },                             
  department: [{ type: String, required: true }],      
  role: {type: String},
  designation:[{type: String}],
  aadharNumber: { type: String },                      
  panNumber: { type: String },                         
  userUpi: { type: String },                           
  pfPercentage: { type: String },                            
  esicPercentage: { type: String },                            
  weeklyHoliday: [{
    type: String,
    enum: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  }],                                                  
  address: { type: String },                          
  accessPermissions: {
  type: [String],
  default: [],
  enum: [
    'dashboard',
    'leads_dashboard',
    'leads_leads',
    'leads_customer',
    'leads_product',
    'lead_report',
    'leads_workflow',

    'list_task',
    'create_task',
    'update_task',
    'delete_task',
    'shifted_task_history',
    'shift_task',
    'create_credit_points',
    'credit_points',

    'settings',
    'settings_category',
    'settings_shift',
    'settings_leads_status',
    'settings_customer_group',
    'settings_leave_type',
   
    'reports',
    'followup_report',
    'task_report',
    'leads_report',
    'attendance_report',
    'leave_report',
    'payment_report',

    'accounts',

    'list_customer',
    'create_customer',
    'update_customer',
    'delete_customer',

    'list_teammember',
    'create_teammember',
    'update_teammember',
    'delete_teammember',

    'attendance',

    'list_leave',
    'create_leave',
    'update_leave',
    'delete_leave',
    'leave_request',
    'leaveAproval',
    'leave_type',


    'list_franchise',
    'create_franchise',
    'update_franchise',
    'delete_franchise',

    'list_business',
    'create_business',
    'update_business',
    'delete_business',

    'chat',

    'list_department',
    'create_department',
    'update_department',
    'delete_department',

    'salary_generation',
    
    'todo_list',

    'user_profile',

    'business_profile',

    'list_project_manager',
    'create_project_manager',
    'update_project_manager',
    'delete_project_manager',

   'customer_support', 
   'com_tickets', 
   'sup_tickets', 
   'employee_performance'
  ],
},

 paidLeaves: [{
    type: { type: String, required: true },         
    count: { type: Number, required: true, min: 0 }  
  }],

  adharImage: { type: String },                       
  panImage: { type: String },                           
  profileImage: { type: String }, 

  // NEW: Dynamic additional documents (user's choice)
  documents: [{
    type: { type: String, required: true, trim: true, minlength: 1 },  // e.g., "Driving License", "Passport"
    url: { type: String, required: true },  // Cloudinary URL
    publicId: { type: String, required: true },  // Cloudinary public ID for deletion
    uploadedAt: { type: Date, default: Date.now }
  }],

  qrCode: { type: String }, 
}, { timestamps: true });

// NEW: Ensure unique types within dynamic documents
employeeSchema.path('documents').validate(function(docs) {
  if (!Array.isArray(docs)) return true;
  const types = docs.map(doc => doc.type.toLowerCase());
  const uniqueTypes = [...new Set(types)];
  return uniqueTypes.length === types.length;  // No duplicates
}, 'Duplicate document types not allowed');

// Hash password before saving
employeeSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('Employee', employeeSchema);
