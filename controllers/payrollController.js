//controllers/payrollController.js
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const Holiday = require('../models/Holiday');
const Payroll = require('../models/Payroll');
const SalaryAdvance = require('../models/SalaryAdvance'); 
const mongoose = require('mongoose');

// Helper: Get day name from date (e.g., 'Sun')
const getDayName = (date) => date.toLocaleDateString('en-US', { weekday: 'short' });

// Helper: Convert legacy object to array (backward compatibility) - Unchanged
const convertToArray = (objOrArray, category) => {
  if (Array.isArray(objOrArray)) {
    return objOrArray;
  }
  if (typeof objOrArray === 'object' && objOrArray !== null) {
    // Legacy: e.g., {tax: 500, providentFund: 200} → [{type: 'Tax', amount: 500}, {type: 'Provident Fund', amount: 200}]
    const legacyMappings = {
      deductions: {
        tax: 'Tax',
        providentFund: 'Provident Fund',
        other: 'Other Deduction'
      },
      incomes: {
        bonus: 'Bonus',
        incentives: 'Incentives',
        other: 'Other Income'
      }
    };
    const mappings = legacyMappings[category] || {};
    return Object.entries(objOrArray).map(([key, amount]) => ({
      type: mappings[key] || key.charAt(0).toUpperCase() + key.slice(1), // Capitalize if no mapping
      amount: parseFloat(amount) || 0
    })).filter(item => item.amount > 0); // Skip zero/negative
  }
  return []; // Empty or invalid → empty array
};

// Controller: Generate payroll slip for selected employee
// exports.generatePayroll = async (req, res) => {
//   console.log("req.body", req.body);
//   console.log("req.user", req.user);
  
//   try {
//     // const { employeeId, payrollMonth, deductions = [], incomes = [] } = req.body; // Expect arrays; fallback to empty

//      const { 
//       employeeId, 
//       payrollMonth, 
//       totalWorkingDays, 
//       totalHalfDays, 
//       totalLeaves, 
//       totalWeeklyHolidays, 
//       totalCompanyHolidays,
//       deductions = [], 
//       incomes = [] 
//     } = req.body; 

//     let companyId = req.user.companyId ||  req.user.id ;  // Default from auth middleware

//     if (!employeeId || !companyId) {
//       return res.status(400).json({ message: 'employeeId and companyId are required' });
//     }

//      // UPDATED: Use provided attendance values instead of recalculating
//     const finalTotalWorkingDays = parseInt(totalWorkingDays) || 0;
//     const finalTotalHalfDays = parseInt(totalHalfDays) || 0;
//     const finalTotalLeaves = parseInt(totalLeaves) || 0;
//     const finalTotalWeeklyHolidays = parseInt(totalWeeklyHolidays) || 0;
//     const finalTotalCompanyHolidays = parseInt(totalCompanyHolidays) || 0;


//     // UPDATED: Handle dynamic deductions/incomes (arrays or legacy objects)
//     let deductionsArray = convertToArray(deductions, 'deductions');
//     let incomesArray = convertToArray(incomes, 'incomes');

//     // Validate arrays: Ensure each has type (string, non-empty) and amount (>=0 number)
//     deductionsArray = deductionsArray.filter(ded => {
//       if (typeof ded.type !== 'string' || ded.type.trim().length === 0) {
//         console.warn(`Invalid deduction skipped: Missing type for ${JSON.stringify(ded)}`);
//         return false;
//       }
//       if (typeof ded.amount !== 'number' || ded.amount < 0) {
//         console.warn(`Invalid deduction skipped: Invalid amount ${ded.amount} for ${ded.type}`);
//         return false;
//       }
//       return true;
//     });

//     incomesArray = incomesArray.filter(inc => {
//       if (typeof inc.type !== 'string' || inc.type.trim().length === 0) {
//         console.warn(`Invalid income skipped: Missing type for ${JSON.stringify(inc)}`);
//         return false;
//       }
//       if (typeof inc.amount !== 'number' || inc.amount < 0) {
//         console.warn(`Invalid income skipped: Invalid amount ${inc.amount} for ${inc.type}`);
//         return false;
//       }
//       return true;
//     });

//     console.log(`Processed ${deductionsArray.length} deductions and ${incomesArray.length} incomes`);

//     // NEW: Fetch undeducted advances for this employee and add to deductions
//     const undeductedAdvances = await SalaryAdvance.find({
//       company: companyId,
//       employee: employeeId,
//       deductedInPayroll: null  // Only undeducted ones
//     }).select('amount notes');  // Minimal fields

//     if (undeductedAdvances.length > 0) {
//       console.log(`Found ${undeductedAdvances.length} undeducted advances for employee ${employeeId}`);
//       // Add each advance to deductions array (as 'Salary Advance' type)
//       const advanceDeductions = undeductedAdvances.map(adv => ({
//         type: 'Salary Advance',  // Fixed type for easy filtering/display
//         amount: adv.amount,
//         notes: adv.notes  // Optional: Include notes if needed for display
//       }));
//       deductionsArray = [...deductionsArray, ...advanceDeductions];
//       console.log('Advances added to deductions:', advanceDeductions);
//     }

//     // Default to current month if not provided
//     const now = new Date();
//     const defaultMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
//     const finalPayrollMonth = payrollMonth || defaultMonth;

//     // Parse payrollMonth to get start/end dates
//     const [year, month] = finalPayrollMonth.split('-').map(Number);
//     const startDate = new Date(year, month - 1, 1);
//     const endDate = new Date(year, month, 0, 23, 59, 59, 999);

//     // Fetch employee (validate company)
//     const employee = await Employee.findOne({ _id: employeeId, company: companyId });
//     if (!employee) {
//       return res.status(404).json({ message: 'Employee not found in your company' });
//     }

//     // Fetch attendance for the month
//     const attendances = await Attendance.find({
//       company: companyId,
//       employee: employeeId,
//       date: { $gte: startDate, $lte: endDate }
//     });

//     // Fetch company holidays for the month
//     const companyHolidays = await Holiday.find({
//       company: companyId,
//       date: { $gte: startDate, $lte: endDate }
//     });
//     const holidayDates = companyHolidays.map(h => h.date.getDate());  // Just dates for exclusion

//     // Calculate metrics from attendance (unchanged)
//     // let totalWorkingDays = 0;
//     // let totalHalfDays = 0;
//     let paidLeaves = 0;
//     let unpaidLeaves = 0;  // Implicit: Calculated but NOT stored

//     // Map attendance by date for easy lookup
//     const attendanceMap = new Map();
//     attendances.forEach(att => {
//       attendanceMap.set(att.date.getDate(), att.status);
//     });

//     // Loop through all days in month
//     const daysInMonth = endDate.getDate();
//     const weeklyHolidays = employee.weeklyHoliday || [];
//     let weeklyHolidayCount = 0;
//     let companyHolidayCount = holidayDates.length;

//     for (let d = 1; d <= daysInMonth; d++) {
//       const currentDate = new Date(year, month - 1, d);
//       const dayName = getDayName(currentDate);
//       const isWeeklyHoliday = weeklyHolidays.includes(dayName);
//       const isCompanyHoliday = holidayDates.includes(d);

//       if (isWeeklyHoliday) {
//         weeklyHolidayCount++;
//         continue;  // No work expected
//       }
//       if (isCompanyHoliday) {
//         continue;  // No work expected
//       }

//       // Non-holiday day: Check attendance
//       const status = attendanceMap.get(d);
//       if (status === 'p') {
//         totalWorkingDays++;
//       } else if (status === 'h') {
//         totalHalfDays++;
//       } else if (status === 'l') {
//         paidLeaves++;  // Paid leave: No deduction
//       } else {
//         // Absent, missing, or other: Implicit unpaid leave (deduct full day)
//         unpaidLeaves++;
//       }
//     }

//     // Base salary (parse if string)
//     const baseSalary = parseFloat(employee.salary) || 0;
//     const pfPercentage = parseFloat(employee.pfPercentage) || 0;  // Parse string to number
//     const esicPercentage = parseFloat(employee.esicPercentage) || 0;  // Parse string to number


//     // Calculate PF and ESIC amounts (only if percentage > 0)
// if (pfPercentage > 0) {
//   const pfAmount = (baseSalary * pfPercentage) / 100;
//   if (pfAmount > 0) {
//     deductionsArray.push({
//       type: 'PF (Provident Fund)',
//       amount: pfAmount
//     });
//     console.log(`Added automatic PF deduction: ${pfAmount} (based on ${pfPercentage}% of ${baseSalary})`);
//   }
// }
// if (esicPercentage > 0) {
//   const esicAmount = (baseSalary * esicPercentage) / 100;
//   if (esicAmount > 0) {
//     deductionsArray.push({
//       type: 'ESIC (Employees\' State Insurance)',
//       amount: esicAmount
//     });
//     console.log(`Added automatic ESIC deduction: ${esicAmount} (based on ${esicPercentage}% of ${baseSalary})`);
//   }
// }


//     // UPDATED: Calculate totals from dynamic arrays (now includes advances)
//     const totalDeductionsManual = deductionsArray.reduce((sum, ded) => sum + ded.amount, 0);
//     const totalIncomes = incomesArray.reduce((sum, inc) => sum + inc.amount, 0);

//     // Total possible working days (exclude all holidays) - Calculated but NOT stored
//     const totalHolidayCount = weeklyHolidayCount + companyHolidayCount;
//     const totalPossibleWorkingDays = daysInMonth - totalHolidayCount;

//     // Implicit unpaid leaves: Non-holiday days not accounted for as present/half/paid
//     const expectedUnpaid = totalPossibleWorkingDays - (totalWorkingDays + totalHalfDays + paidLeaves);
//     if (unpaidLeaves !== expectedUnpaid) {
//       console.warn('Unpaid leaves mismatch; using calculated:', expectedUnpaid);
//       unpaidLeaves = expectedUnpaid;
//     }

//     // Calculations (unchanged)
//     const dailySalary = totalPossibleWorkingDays > 0 ? baseSalary / totalPossibleWorkingDays : 0;
//     const leaveDeduction = dailySalary * unpaidLeaves;  // Full day for unpaid
//     const halfDayDeduction = dailySalary * 0.5 * totalHalfDays;
//     const totalLeaveHalfDeductions = leaveDeduction + halfDayDeduction;

//     const totalDeductions = totalDeductionsManual + totalLeaveHalfDeductions;
//     const netSalary = baseSalary - totalDeductions + totalIncomes;

//     // NEW: Save payroll first (to get ID for advance updates)

//     const payroll = new Payroll({
//       company: companyId,
//       employee: employeeId,
//       salary: baseSalary,
//       weeklyHoliday: weeklyHolidays,
//       totalWorkingDays,
//       totalHalfDays,
//       paidLeaves,
//       holidayCount: totalHolidayCount,
//       deductions: deductionsArray,  // Includes user + advances
//       incomes: incomesArray,
//       totalDeductions,
//       totalIncomes,
//       netSalary,
//       payrollMonth: finalPayrollMonth,
//     });

//     await payroll.save();

//     // NEW: After saving, mark undeducted advances as deducted in this payroll
//     if (undeductedAdvances.length > 0) {
//       const updatePromises = undeductedAdvances.map(async (adv) => {
//         await SalaryAdvance.findByIdAndUpdate(adv._id, { deductedInPayroll: payroll._id });
//         console.log(`Marked advance ${adv._id} as deducted in payroll ${payroll._id}`);
//       });
//       await Promise.all(updatePromises);
//       console.log(`All ${undeductedAdvances.length} advances marked as deducted`);
//     }

//     // Populate for full salary slip
//     await payroll.populate('employee', 'firstName lastName salary department');

//     const advanceDeductions = deductionsArray.filter(ded => ded.type === 'Salary Advance');
//     const totalAdvancesDeducted = advanceDeductions.reduce((sum, ded) => sum + ded.amount, 0);

//     // NEW: Extract PF/ESIC from deductions for summary (optional, for frontend breakdown)
//     const pfDeduction = deductionsArray.find(ded => ded.type === 'PF (Provident Fund)') || { amount: 0 };
//     const esicDeduction = deductionsArray.find(ded => ded.type === 'ESIC (Employees\' State Insurance)') || { amount: 0 };

//     res.status(201).json({
//       message: 'Salary slip generated successfully',
//       payroll,  // Stored details (deductions includes PF/ESIC)
//       summary: {  // Calculated values for frontend
//         baseSalary,
//         totalPossibleWorkingDays,
//         dailySalary,
//         workedDays: totalWorkingDays + (totalHalfDays * 0.5),
//         paidLeaves,
//         unpaidLeaves,
//         holidayCount: totalHolidayCount,
//         deductions: deductionsArray,  // Full list (includes PF/ESIC + advances)
//         advancesDeducted: advanceDeductions,  // Advances only
//         totalAdvancesDeducted,  // Sum of advances
//         pfDeduction: pfDeduction.amount,  // NEW: PF amount
//         esicDeduction: esicDeduction.amount,  // NEW: ESIC amount
//         totalDeductionsManual,  // Sum of all manual (user + advances + PF/ESIC)
//         totalLeaveHalfDeductions,
//         totalDeductions,
//         incomes: incomesArray,
//         totalIncomes,
//         netSalary
//       }
//     });
//   } catch (error) {
//     console.error('Payroll generation error:', error);
//     res.status(500).json({ message: 'Server error', error: error.message });
//   }
// };


// UPDATED: generatePayroll - Use provided attendance values instead of recalculating
exports.generatePayroll = async (req, res) => {
  console.log("req.body", req.body);
  console.log("req.user", req.user);
  
  try {
    const { 
      employeeId, 
      payrollMonth, 
      totalWorkingDays, 
      totalHalfDays, 
      totalLeaves, 
      totalWeeklyHolidays, 
      totalCompanyHolidays,
      deductions = [], 
      incomes = [] 
    } = req.body; // Use provided attendance values
    let companyId = req.user.companyId || req.user.id;
    
    if (!employeeId || !companyId) {
      return res.status(400).json({ message: 'employeeId and companyId are required' });
    }

    // UPDATED: Use provided attendance values instead of recalculating
    const finalTotalWorkingDays = parseInt(totalWorkingDays) || 0;
    const finalTotalHalfDays = parseInt(totalHalfDays) || 0;
    const finalTotalLeaves = parseInt(totalLeaves) || 0;
    const finalTotalWeeklyHolidays = parseInt(totalWeeklyHolidays) || 0;
    const finalTotalCompanyHolidays = parseInt(totalCompanyHolidays) || 0;

    // UPDATED: Handle dynamic deductions/incomes (arrays or legacy objects)
    let deductionsArray = convertToArray(deductions, 'deductions');
    let incomesArray = convertToArray(incomes, 'incomes');

    // Validate arrays: Ensure each has type (string, non-empty) and amount (>=0 number)
    deductionsArray = deductionsArray.filter(ded => {
      if (typeof ded.type !== 'string' || ded.type.trim().length === 0) {
        console.warn(`Invalid deduction skipped: Missing type for ${JSON.stringify(ded)}`);
        return false;
      }
      if (typeof ded.amount !== 'number' || ded.amount < 0) {
        console.warn(`Invalid deduction skipped: Invalid amount ${ded.amount} for ${ded.type}`);
        return false;
      }
      return true;
    });

    incomesArray = incomesArray.filter(inc => {
      if (typeof inc.type !== 'string' || inc.type.trim().length === 0) {
        console.warn(`Invalid income skipped: Missing type for ${JSON.stringify(inc)}`);
        return false;
      }
      if (typeof inc.amount !== 'number' || inc.amount < 0) {
        console.warn(`Invalid income skipped: Invalid amount ${inc.amount} for ${inc.type}`);
        return false;
      }
      return true;
    });

    console.log(`Processed ${deductionsArray.length} deductions and ${incomesArray.length} incomes`);

    // NEW: Fetch undeducted advances for this employee and add to deductions
    const undeductedAdvances = await SalaryAdvance.find({
      company: new mongoose.Types.ObjectId(companyId), // Fixed ObjectId
      employee: employeeId,
      deductedInPayroll: null  // Only undeducted ones
    }).select('amount notes');  // Minimal fields

    if (undeductedAdvances.length > 0) {
      console.log(`Found ${undeductedAdvances.length} undeducted advances for employee ${employeeId}`);
      // Add each advance to deductions array (as 'Salary Advance' type)
      const advanceDeductions = undeductedAdvances.map(adv => ({
        type: 'Salary Advance',  // Fixed type for easy filtering/display
        amount: adv.amount,
        notes: adv.notes  // Optional: Include notes if needed for display
      }));
      deductionsArray = [...deductionsArray, ...advanceDeductions];
      console.log('Advances added to deductions:', advanceDeductions);
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
    const employee = await Employee.findOne({ _id: employeeId, company: new mongoose.Types.ObjectId(companyId) }); // Fixed ObjectId
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found in your company' });
    }

    // Base salary (parse if string)
    const baseSalary = parseFloat(employee.salary) || 0;
    const pfPercentage = parseFloat(employee.pfPercentage) || 0;  // Parse string to number
    const esicPercentage = parseFloat(employee.esicPercentage) || 0;  // Parse string to number

    // Calculate PF and ESIC amounts (only if percentage > 0)
    if (pfPercentage > 0) {
      const pfAmount = (baseSalary * pfPercentage) / 100;
      if (pfAmount > 0) {
        deductionsArray.push({
          type: 'PF (Provident Fund)',
          amount: pfAmount
        });
        console.log(`Added automatic PF deduction: ${pfAmount} (based on ${pfPercentage}% of ${baseSalary})`);
      }
    }
    if (esicPercentage > 0) {
      const esicAmount = (baseSalary * esicPercentage) / 100;
      if (esicAmount > 0) {
        deductionsArray.push({
          type: 'ESIC (Employees\' State Insurance)',
          amount: esicAmount
        });
        console.log(`Added automatic ESIC deduction: ${esicAmount} (based on ${esicPercentage}% of ${baseSalary})`);
      }
    }

    // UPDATED: Calculate totals from dynamic arrays (now includes advances)
    const totalDeductionsManual = deductionsArray.reduce((sum, ded) => sum + ded.amount, 0);
    const totalIncomes = incomesArray.reduce((sum, inc) => sum + inc.amount, 0);

    // UPDATED: Use provided attendance values for calculations
    const totalHolidayCount = finalTotalWeeklyHolidays + finalTotalCompanyHolidays;
    const totalPossibleWorkingDays = new Date(year, month, 0).getDate() - totalHolidayCount;

    // Calculations (unchanged)
    const dailySalary = totalPossibleWorkingDays > 0 ? baseSalary / totalPossibleWorkingDays : 0;
    const leaveDeduction = dailySalary * finalTotalLeaves;  // Full day for unpaid
    const halfDayDeduction = dailySalary * 0.5 * finalTotalHalfDays;
    const totalLeaveHalfDeductions = leaveDeduction + halfDayDeduction;

    const totalDeductions = totalDeductionsManual + totalLeaveHalfDeductions;
    const netSalary = baseSalary - totalDeductions + totalIncomes;

    // NEW: Save payroll first (to get ID for advance updates)
    const payroll = new Payroll({
      company: new mongoose.Types.ObjectId(companyId), // Fixed ObjectId
      employee: employeeId,
      salary: baseSalary,
      weeklyHoliday: employee.weeklyHoliday || [],
      totalWorkingDays: finalTotalWorkingDays, // Use provided value
      totalHalfDays: finalTotalHalfDays, // Use provided value
      paidLeaves: finalTotalLeaves, // Use provided value
      holidayCount: totalHolidayCount,
      deductions: deductionsArray,  // Includes user + advances
      incomes: incomesArray,
      totalDeductions,
      totalIncomes,
      netSalary,
      payrollMonth: finalPayrollMonth,
    });

    await payroll.save();

    // NEW: After saving, mark undeducted advances as deducted in this payroll
    if (undeductedAdvances.length > 0) {
      const updatePromises = undeductedAdvances.map(async (adv) => {
        await SalaryAdvance.findByIdAndUpdate(adv._id, { deductedInPayroll: payroll._id });
        console.log(`Marked advance ${adv._id} as deducted in payroll ${payroll._id}`);
      });
      await Promise.all(updatePromises);
      console.log(`All ${undeductedAdvances.length} advances marked as deducted`);
    }

    // Populate for full salary slip
    await payroll.populate('employee', 'firstName lastName salary department');

    const advanceDeductions = deductionsArray.filter(ded => ded.type === 'Salary Advance');
    const totalAdvancesDeducted = advanceDeductions.reduce((sum, ded) => sum + ded.amount, 0);

    // NEW: Extract PF/ESIC from deductions for summary (optional, for frontend breakdown)
    const pfDeduction = deductionsArray.find(ded => ded.type === 'PF (Provident Fund)') || { amount: 0 };
    const esicDeduction = deductionsArray.find(ded => ded.type === 'ESIC (Employees\' State Insurance)') || { amount: 0 };

    res.status(201).json({
      message: 'Salary slip generated successfully',
      payroll,  // Stored details (deductions includes PF/ESIC)
      summary: {  // Calculated values for frontend
        baseSalary,
        totalPossibleWorkingDays,
        dailySalary,
        workedDays: finalTotalWorkingDays + (finalTotalHalfDays * 0.5),
        paidLeaves: finalTotalLeaves,
        unpaidLeaves: finalTotalLeaves, // Assuming provided leaves are unpaid
        holidayCount: totalHolidayCount,
        deductions: deductionsArray,  // Full list (includes PF/ESIC + advances)
        advancesDeducted: advanceDeductions,  // Advances only
        totalAdvancesDeducted,  // Sum of advances
        pfDeduction: pfDeduction.amount,  // NEW: PF amount
        esicDeduction: esicDeduction.amount,  // NEW: ESIC amount
        totalDeductionsManual,  // Sum of all manual (user + advances + PF/ESIC)
        totalLeaveHalfDeductions,
        totalDeductions,
        incomes: incomesArray,
        totalIncomes,
        netSalary
      }
    });
  } catch (error) {
    console.error('Payroll generation error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// Controller: Get salary slip by employee, year, month (company-scoped) - UPDATED with pending advances
exports.getPayrollByEmployeeAndMonth = async (req, res) => {
  try {
    console.log("req.params",req.params);
    console.log(" req.user", req.user);
    
    const { employeeId, year, month } = req.params;
    const companyId = req.user.companyId ||  req.user.id;

    if (!employeeId || !year || !month) {
      return res.status(400).json({ message: 'employeeId, year and month are required' });
    }

    const monthStr = month.toString().padStart(2, '0');
    const payrollMonthStr = `${year}-${monthStr}`;

    console.log("employeeId",employeeId);
    console.log("companyId",companyId);
    console.log("payrollMonthStr",payrollMonthStr);
    
    // Find with company scoping
    const payroll = await Payroll.findOne({ 
      employee: employeeId, 
      company: companyId, 
      payrollMonth: payrollMonthStr 
    }).populate('employee', 'firstName lastName salary department');
    console.log("payroll",payroll);

    if (!payroll) {
      return res.status(404).json({ message: 'Salary slip not found' });
    }

    // UPDATED: Calculate totals from arrays + fetch pending (undeducted) advances for this employee
    const totalDeductionsManual = payroll.deductions.reduce((sum, ded) => sum + ded.amount, 0);
    const totalIncomes = payroll.incomes.reduce((sum, inc) => sum + inc.amount, 0);

    // NEW: Get pending advances (undeducted, for post-payroll display e.g., "Next month's deductions")
    const pendingAdvances = await SalaryAdvance.find({
      company: companyId,
      employee: employeeId,
      deductedInPayroll: null  // Only undeducted
    }).select('amount date notes').sort({ createdAt: -1 }).limit(5);  // Recent 5 for summary

    const totalPendingAdvances = pendingAdvances.reduce((sum, adv) => sum + adv.amount, 0);

    // NEW: Filter historical advances deducted in this payroll (for breakdown)
    const advancesInThisPayroll = payroll.deductions.filter(ded => ded.type === 'Salary Advance');

    res.json({
      message: 'Salary slip retrieved',
      payroll,
      summary: {  // Optional breakdown
        deductions: payroll.deductions,
        advancesInThisPayroll,  // NEW: Advances deducted here
        totalAdvancesDeducted: advancesInThisPayroll.reduce((sum, ded) => sum + ded.amount, 0),
        totalDeductionsManual,  // Sum of all manual (user + advances)
        incomes: payroll.incomes,
        totalIncomes,
        pendingAdvances,  // NEW: Undeducted advances (for future awareness)
        totalPendingAdvances   // NEW: Sum of pending
      }
    });
  } catch (error) {
    console.error('Get payroll error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Controller: Get all employees' payroll history by company ID - UPDATED with aggregate pending advances
exports.getCompanyPayrollHistory = async (req, res) => {
  try {
    let companyId = req.query.companyId || req.user.companyId ||  req.user.id;  // Allow query param (e.g., for superadmin); default to user's company

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

// UPDATED: Fix ObjectId constructor in aggregation pipeline
const allPendingAdvances = await SalaryAdvance.aggregate([
  { $match: { company: new mongoose.Types.ObjectId(companyId), deductedInPayroll: null } },
  {
    $group: {
      _id: '$employee',
      totalPending: { $sum: '$amount' },
      count: { $sum: 1 }
    }
  },
  { $lookup: {
    from: 'employees',
    localField: '_id',
    foreignField: '_id',
    as: 'employee',
    pipeline: [{ $project: { teamMemberName: 1, department: 1 } }]
  } },
  { $unwind: '$employee' },
  { $sort: { totalPending: -1 } },
  { $limit: 10 }  // Top 10 employees with pending advances
]);


    // NEW: Enhance each payroll with employee-specific pending advances (optional, for detailed view)
    const enhancedPayrolls = await Promise.all(payrolls.map(async (payroll) => {
      const employeePendingAdvances = await SalaryAdvance.find({
        company: companyId,
        employee: payroll.employee._id,
        deductedInPayroll: null
      }).select('amount').lean();

      const totalEmployeePending = employeePendingAdvances.reduce((sum, adv) => sum + adv.amount, 0);

      return {
        ...payroll.toObject(),
        employeePendingAdvances: totalEmployeePending  // NEW: Per-employee pending for this payroll record
      };
    }));

    res.json({
      message: `Company payroll history for ${companyId}`,
      companyId,
      payrolls: enhancedPayrolls,  // Enhanced with pending advances
      pendingAdvancesSummary: {  // NEW: Company-wide aggregate
        totalPendingAcrossCompany: allPendingAdvances.reduce((sum, emp) => sum + emp.totalPending, 0),
        topPendingEmployees: allPendingAdvances,  // Array of { _id, totalPending, count, employee }
        totalPendingRecords: allPendingAdvances.length
      },
      count: payrolls.length,
      filters: { year, month }  // Echo for frontend
    });
  } catch (error) {
    console.error('Get company payroll error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
