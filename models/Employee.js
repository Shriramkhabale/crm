//models/Employee.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const employeeSchema = new mongoose.Schema({
  company: { type: String, required: true }, // or ObjectId ref if you have Company collection
  teamMemberName: { type: String, required: true },  
  mobileNumber: { type: String, required: true },    // Mobile Number *
  emergencyMobileNumber: { type: String },            // Emergency Mob no
  email: { type: String, required: true, unique: true }, // Email Address *
  password: { type: String, required: true },
  salary: { type: String },                            // Salary *
  dateOfJoining: { type: Date },                       // Date of Joining
  shift: { type: String },                             // Shift (dynamic dropdown)
  department: [{ type: String, required: true }],       // Department (dynamic dropdown)
  role: {type: String},
  designation:[{type: String}],
  aadharNumber: { type: String },                       // Aadhar Number
  panNumber: { type: String },                          // Pan Number
  userUpi: { type: String },                            // User Upi
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
  qrCode: { type: String }, 
}, { timestamps: true });

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