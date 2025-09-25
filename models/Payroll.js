//models/Payroll.js
const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },

  salary: { type: Number, required: true }, // Base salary
  weeklyHoliday: [{ type: String, enum: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] }],

  totalWorkingDays: { type: Number, default: 0 },
  totalHalfDays: { type: Number, default: 0 },
  paidLeaves: { type: Number, default: 0 },  // Paid leaves (no deduction)
  holidayCount: { type: Number, default: 0 },  // Company + weekly holidays (no work expected)

  deductions: {
    tax: { type: Number, default: 0 },
    providentFund: { type: Number, default: 0 },
    other: { type: Number, default: 0 },
  },

  incomes: {
    bonus: { type: Number, default: 0 },
    incentives: { type: Number, default: 0 },
    other: { type: Number, default: 0 },
  },

  totalDeductions: { type: Number, default: 0 },  // Includes manual + auto leave/half deductions
  totalIncomes: { type: Number, default: 0 },
  netSalary: { type: Number, default: 0 },

  payrollMonth: { type: String, required: true }, // e.g. '2024-09'

}, { timestamps: true });

// Indexes for efficient company-wide queries
payrollSchema.index({ company: 1, payrollMonth: 1 });
payrollSchema.index({ company: 1, employee: 1, payrollMonth: 1 });

module.exports = mongoose.model('Payroll', payrollSchema);
