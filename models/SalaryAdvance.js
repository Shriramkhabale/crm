//models/SalaryAdvance.js

const mongoose = require('mongoose');

const salaryAdvanceSchema = new mongoose.Schema({
  company: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Company', 
    required: true 
  },
  employee: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Employee', 
    required: true 
  },
  amount: { 
    type: Number, 
    required: true, 
    min: 0 
  },
  date: { 
    type: Date, 
    default: Date.now  
  },
  approvedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Employee' 
  },
  notes: { 
    type: String, 
    maxlength: 500 
  },
  // ADDED: Minimal field to track deduction (essential for payroll integration; prevents double-deduction)
  deductedInPayroll: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Payroll'  // Set to Payroll ID when deducted
  }
}, { timestamps: true });

salaryAdvanceSchema.index({ company: 1, employee: 1 });

module.exports = mongoose.model('SalaryAdvance', salaryAdvanceSchema);
