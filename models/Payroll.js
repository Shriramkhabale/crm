const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },

  salary: { type: Number, required: true }, // Base salary
  weeklyHoliday: [{ type: String, enum: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] }],

  totalWorkingDays: { type: Number, default: 0 },
  totalHalfDays: { type: Number, default: 0 },
  paidLeaves: { type: Number, default: 0 },  
  holidayCount: { type: Number, default: 0 },  

  deductions: [{
    type: { type: String, required: true, trim: true, minlength: 1 }, // e.g., "Tax", "Custom Penalty"
    amount: { type: Number, required: true, min: 0 } // Positive amount (subtract ed in netSalary)
  }],

  incomes: [{
    type: { type: String, required: true, trim: true, minlength: 1 }, // e.g., "Bonus", "Overtime"
    amount: { type: Number, required: true, min: 0 } // Positive amount (added to netSalary)
  }],

  totalDeductions: { type: Number, default: 0 },  // Sum of deductions array + auto leave/half deductions
  totalIncomes: { type: Number, default: 0 },     // Sum of incomes array
  netSalary: { type: Number, default: 0 },

  payrollMonth: { type: String, required: true }, // e.g. '2024-09'
}, { timestamps: true });

// * for efficient company-wide queries
payrollSchema.index({ company: 1, payrollMonth: 1 });
payrollSchema.index({ company: 1, employee: 1, payrollMonth: 1 });

module.exports = mongoose.model('Payroll', payrollSchema);