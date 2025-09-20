// models/Payroll.js
const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },

  salary: { type: Number, required: true }, // base salary
  weeklyHoliday: [{ type: String, enum: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] }],

  totalWorkingDays: { type: Number, default: 0 },
  totalHalfDays: { type: Number, default: 0 },
  totalLeaves: { type: Number, default: 0 },

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

  totalDeductions: { type: Number, default: 0 },
  totalIncomes: { type: Number, default: 0 },
  netSalary: { type: Number, default: 0 },

  payrollMonth: { type: String, required: true }, // e.g. '2024-06'

}, { timestamps: true });

module.exports = mongoose.model('Payroll', payrollSchema);
