const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const Holiday = require('../models/Holiday'); // Company holidays
const Payroll = require('../models/Payroll');

// Helper: Get day name from date (e.g., 'Sun')
const getDayName = (date) => date.toLocaleDateString('en-US', { weekday: 'short' });

// Controller: Generate payroll slip for selected employee
exports.generatePayroll = async (req, res) => {
  try {
    const { employeeId, payrollMonth, deductions = {}, incomes = {} } = req.body;
    let companyId = req.user.companyId;  // Default from auth middleware

    if (!employeeId || !companyId) {
      return res.status(400).json({ message: 'employeeId and companyId are required' });
    }

    // Default to current month if not provided
    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    const finalPayrollMonth = payrollMonth || defaultMonth;

    // Parse payrollMonth to get start/end dates
    const [year, month] = finalPayrollMonth.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    // Fetch employee (validate company)
    const employee = await Employee.findOne({ _id: employeeId, company: companyId });
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found in your company' });
    }
    console.log("Attendance",Attendance);
    

    // Fetch attendance for the month
    const attendances = await Attendance.find({
      company: companyId,
      employee: employeeId,
      date: { $gte: startDate, $lte: endDate }
    });

    // Fetch company holidays for the month
    const companyHolidays = await Holiday.find({
      company: companyId,
      date: { $gte: startDate, $lte: endDate }
    });
    const holidayDates = companyHolidays.map(h => h.date.getDate());  // Just dates for exclusion

    // Calculate metrics from attendance
    let totalWorkingDays = 0;
    let totalHalfDays = 0;
    let paidLeaves = 0;
    let unpaidLeaves = 0;  // Implicit: Calculated but NOT stored
console.log("attendances",attendances);

    // Map attendance by date for easy lookup
    const attendanceMap = new Map();
    attendances.forEach(att => {
      attendanceMap.set(att.date.getDate(), att.status);
    });

    // Loop through all days in month
    const daysInMonth = endDate.getDate();
    const weeklyHolidays = employee.weeklyHoliday || [];
    let weeklyHolidayCount = 0;
    let companyHolidayCount = holidayDates.length;

    for (let d = 1; d <= daysInMonth; d++) {
      const currentDate = new Date(year, month - 1, d);
      const dayName = getDayName(currentDate);
      const isWeeklyHoliday = weeklyHolidays.includes(dayName);
      const isCompanyHoliday = holidayDates.includes(d);

      if (isWeeklyHoliday) {
        weeklyHolidayCount++;
        continue;  // No work expected
      }
      if (isCompanyHoliday) {
        continue;  // No work expected
      }
console.log("attendanceMap",attendanceMap);

      // Non-holiday day: Check attendance
      const status = attendanceMap.get(d);
      if (status === 'p') {
        totalWorkingDays++;
      } else if (status === 'h') {
        totalHalfDays++;
      } else if (status === 'l') {
        paidLeaves++;  // Paid leave: No deduction
      } else {
        // Absent, missing, or other: Implicit unpaid leave (deduct full day)
        unpaidLeaves++;
      }
    }

    // Base salary (parse if string)
    const baseSalary = parseFloat(employee.salary) || 0;

    // User-provided deductions/incomes
    const tax = deductions.tax || 0;
    const providentFund = deductions.providentFund || 0;
    const otherDeductions = deductions.other || 0;

    const bonus = incomes.bonus || 0;
    const incentives = incomes.incentives || 0;
    const otherIncomes = incomes.other || 0;

    const totalDeductionsManual = tax + providentFund + otherDeductions;
    const totalIncomes = bonus + incentives + otherIncomes;

    // Total possible working days (exclude all holidays) - Calculated but NOT stored
    const totalHolidayCount = weeklyHolidayCount + companyHolidayCount;
    const totalPossibleWorkingDays = daysInMonth - totalHolidayCount;

    // Implicit unpaid leaves: Non-holiday days not accounted for as present/half/paid
    // (Already calculated in loop; verify: unpaidLeaves should == totalPossibleWorkingDays - (working + half + paid))
    const expectedUnpaid = totalPossibleWorkingDays - (totalWorkingDays + totalHalfDays + paidLeaves);
    if (unpaidLeaves !== expectedUnpaid) {
      console.warn('Unpaid leaves mismatch; using calculated:', expectedUnpaid);
      unpaidLeaves = expectedUnpaid;
    }

    // Calculations (NOT stored: totalPossibleWorkingDays, dailySalary)
    const dailySalary = totalPossibleWorkingDays > 0 ? baseSalary / totalPossibleWorkingDays : 0;
    const leaveDeduction = dailySalary * unpaidLeaves;  // Full day for unpaid
    const halfDayDeduction = dailySalary * 0.5 * totalHalfDays;
    const totalLeaveHalfDeductions = leaveDeduction + halfDayDeduction;  // Auto-calculated, NOT stored separately

    const totalDeductions = totalDeductionsManual + totalLeaveHalfDeductions;
    const netSalary = baseSalary - totalDeductions + totalIncomes;

    // Save payroll record (only store essentials; omit implicit/calc fields)
    const payroll = new Payroll({
      company: companyId,
      employee: employeeId,
      salary: baseSalary,
      weeklyHoliday: weeklyHolidays,
      totalWorkingDays,
      totalHalfDays,
      paidLeaves,  // Stored (useful for slips)
      holidayCount: totalHolidayCount,  // Stored (transparency)
      deductions: {
        tax,
        providentFund,
        other: otherDeductions,
        // Omitted: leaveDeduction (auto-added to totalDeductions)
      },
      incomes: {
        bonus,
        incentives,
        other: otherIncomes,
      },
      totalDeductions,  // Includes manual + auto leave/half
      totalIncomes,
      netSalary,
      payrollMonth: finalPayrollMonth,
    });

    await payroll.save();

    // Populate for full salary slip
    await payroll.populate('employee', 'firstName lastName salary department');

    res.status(201).json({
      message: 'Salary slip generated successfully',
      payroll,  // Stored details
      summary: {  // Calculated values for frontend (not stored)
        baseSalary,
        totalPossibleWorkingDays,
        dailySalary,
        workedDays: totalWorkingDays + (totalHalfDays * 0.5),
        paidLeaves,
        unpaidLeaves,  // Implicit, shown for transparency
        holidayCount: totalHolidayCount,
        totalDeductionsManual,
        totalLeaveHalfDeductions,  // Breakdown
        totalDeductions,
        totalIncomes,
        netSalary
      }
    });

  } catch (error) {
    console.error('Payroll generation error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Controller: Get salary slip by employee, year, month (company-scoped)
exports.getPayrollByEmployeeAndMonth = async (req, res) => {
  try {
    const { employeeId, year, month } = req.params;
    const companyId = req.user.companyId;

    if (!employeeId || !year || !month) {
      return res.status(400).json({ message: 'employeeId, year and month are required' });
    }

    const monthStr = month.toString().padStart(2, '0');
    const payrollMonthStr = `${year}-${monthStr}`;

    // Find with company scoping
    const payroll = await Payroll.findOne({ 
      employee: employeeId, 
      company: companyId, 
      payrollMonth: payrollMonthStr 
    }).populate('employee', 'firstName lastName salary department');

    if (!payroll) {
      return res.status(404).json({ message: 'Salary slip not found' });
    }

    res.json({
      message: 'Salary slip retrieved',
      payroll
    });
  } catch (error) {
    console.error('Get payroll error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Controller: Get all employees' payroll history by company ID
exports.getCompanyPayrollHistory = async (req, res) => {
  try {
    let companyId = req.query.companyId || req.user.companyId;  // Allow query param (e.g., for superadmin); default to user's company

    if (!companyId) {
      return res.status(400).json({ message: 'companyId is required' });
    }

    const { year, month } = req.query;  // Optional filters

    const filters = { company: companyId };
    if (year && month) {
      const monthStr = month.toString().padStart(2, '0');
      filters.payrollMonth = `${year}-${monthStr}`;
    }

    const payrolls = await Payroll.find(filters)
      .populate('employee', 'firstName lastName department salary')
      .sort({ payrollMonth: -1, createdAt: -1 })  // Recent months first
      .limit(100);  // Reasonable limit

    res.json({
      message: `Company payroll history for ${companyId}`,
      companyId,
      payrolls,
      count: payrolls.length,
      filters: { year, month }  // Echo for frontend
    });
  } catch (error) {
    console.error('Get company payroll error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};