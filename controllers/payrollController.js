// controllers/payrollController.js
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const Holiday = require('../models/Holiday'); // import Holiday model

const mongoose = require('mongoose');

// Payroll schema (new)
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

const Payroll = mongoose.model('Payroll', payrollSchema);


// Controller function to generate payroll for an employee for a given month
exports.generatePayroll = async (req, res) => {
  try {
    const { employeeId, companyId, payrollMonth } = req.body;
    if (!employeeId || !companyId || !payrollMonth) {
      return res.status(400).json({ message: 'employeeId, companyId and payrollMonth are required' });
    }

    // Fetch employee details
    const employee = await Employee.findOne({ _id: employeeId, company: companyId });
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    // Parse payrollMonth to get start and end dates
    const [year, month] = payrollMonth.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    // Fetch attendance records for employee in that month
    const attendances = await Attendance.find({
      company: companyId,
      employee: employeeId,
      date: { $gte: startDate, $lte: endDate }
    });

    // Calculate total working days, half days, leaves
    let totalWorkingDays = 0;
    let totalHalfDays = 0;
    let totalLeaves = 0;

    attendances.forEach(att => {
      if (att.status === 'p') totalWorkingDays++;
      else if (att.status === 'h') totalHalfDays++;
      else totalLeaves++;
    });

    // Convert salary string to number (assuming salary stored as string)
    const baseSalary = parseFloat(employee.salary) || 0;

    // Calculate deductions and incomes (you can customize or get from req.body)
    // For example, here we take from req.body or default 0
    const {
      deductions = {},
      incomes = {}
    } = req.body;

    const tax = deductions.tax || 0;
    const providentFund = deductions.providentFund || 0;
    const otherDeductions = deductions.other || 0;

    const bonus = incomes.bonus || 0;
    const incentives = incomes.incentives || 0;
    const otherIncomes = incomes.other || 0;

    const totalDeductions = tax + providentFund + otherDeductions;
    const totalIncomes = bonus + incentives + otherIncomes;


    const daysInMonth = endDate.getDate();

    // Calculate number of weekly holidays in the month
    const weeklyHolidays = employee.weeklyHoliday || [];
    let weeklyHolidayCount = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dayName = new Date(year, month - 1, d).toLocaleDateString('en-US', { weekday: 'short' });
      if (weeklyHolidays.includes(dayName)) weeklyHolidayCount++;
    }

    const totalPossibleWorkingDays = daysInMonth - weeklyHolidayCount;

    // Calculate salary deduction for leaves and half days
    const dailySalary = baseSalary / totalPossibleWorkingDays;
    const leaveDeduction = dailySalary * totalLeaves;
    const halfDayDeduction = dailySalary * 0.5 * totalHalfDays;

    const netSalary = baseSalary - leaveDeduction - halfDayDeduction - totalDeductions + totalIncomes;

    // Save payroll record
    const payroll = new Payroll({
      company: companyId,
      employee: employeeId,
      salary: baseSalary,
      weeklyHoliday: weeklyHolidays,
      totalWorkingDays,
      totalHalfDays,
      totalLeaves,
      deductions: {
        tax,
        providentFund,
        other: otherDeductions,
      },
      incomes: {
        bonus,
        incentives,
        other: otherIncomes,
      },
      totalDeductions,
      totalIncomes,
      netSalary,
      payrollMonth,
    });

    await payroll.save();

    res.status(201).json({ message: 'Payroll generated', payroll });

  } catch (error) {
    console.error('Payroll generation error:', error);
    res.status(500).json({ message: 'Server error', error: error.message || error });
  }
};


// Get payroll by employee and month
// exports.getPayrollByEmployeeAndMonth = async (req, res) => {
//   try {
//     const { employeeId, payrollMonth } = req.params;
//     if (!employeeId || !payrollMonth) {
//       return res.status(400).json({ message: 'employeeId and payrollMonth are required' });
//     }

//     const payroll = await Payroll.findOne({ employee: employeeId, payrollMonth });
//     if (!payroll) return res.status(404).json({ message: 'Payroll not found' });

//     res.json(payroll);
//   } catch (error) {
//     res.status(500).json({ message: 'Server error', error: error.message || error });
//   }
// };


// Get payroll(s) by employee and year-month (e.g. 2024 and 6)
exports.getPayrollByEmployeeAndMonth = async (req, res) => {
  try {
    const { employeeId, year, month } = req.params;

    if (!employeeId || !year || !month) {
      return res.status(400).json({ message: 'employeeId, year and month are required' });
    }

    // Format month to 2 digits
    const monthStr = month.toString().padStart(2, '0');
    const payrollMonthStr = `${year}-${monthStr}`; // e.g. "2024-06"

    // Find payroll(s) matching employee and payrollMonth string
    const payroll = await Payroll.findOne({ employee: employeeId, payrollMonth: payrollMonthStr });

    if (!payroll) return res.status(404).json({ message: 'Payroll not found' });

    res.json(payroll);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message || error });
  }
};
