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
         totalWeeklyHolidays,  // This will be overridden by calculation
         totalCompanyHolidays,
         deductions = [], 
         incomes = [] 
       } = req.body; // Use provided attendance values
       let companyId = req.user.companyId || req.user.id;
       
       if (!employeeId || !companyId) {
         return res.status(400).json({ message: 'employeeId and companyId are required' });
       }

       // UPDATED: Use provided attendance values except totalWeeklyHolidays (calculated below)
       const finalTotalWorkingDays = parseInt(totalWorkingDays) || 0;
       const finalTotalHalfDays = parseInt(totalHalfDays) || 0;
       const finalTotalLeaves = parseInt(totalLeaves) || 0;
       // finalTotalWeeklyHolidays will be calculated below
      //  const finalTotalCompanyHolidays = parseInt(totalCompanyHolidays) || 0;

       // UPDATED: Handle dynamic deductions/incomes (arrays or legacy objects)
       let deductionsArray = convertToArray(deductions, 'deductions');
       let incomesArray = convertToArray(incomes, 'incomes');

       // Validate arrays
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

       // NEW: Fetch undeducted advances
       const undeductedAdvances = await SalaryAdvance.find({
         company: new mongoose.Types.ObjectId(companyId),
         employee: employeeId,
         deductedInPayroll: null
       }).select('amount notes');

       if (undeductedAdvances.length > 0) {
         const advanceDeductions = undeductedAdvances.map(adv => ({
           type: 'Salary Advance',
           amount: adv.amount,
           notes: adv.notes
         }));
         deductionsArray = [...deductionsArray, ...advanceDeductions];
         console.log('Advances added to deductions:', advanceDeductions);
       }

       // Default payroll month
       const now = new Date();
       const defaultMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
       const finalPayrollMonth = payrollMonth || defaultMonth;

       // Parse month for days
       const [year, month] = finalPayrollMonth.split('-').map(Number);
       const totalMonthDays = new Date(year, month, 0).getDate();

       // Fetch employee
       const employee = await Employee.findOne({ _id: employeeId, company: new mongoose.Types.ObjectId(companyId) });
       if (!employee) {
         return res.status(404).json({ message: 'Employee not found in your company' });
       }

       // UPDATED: Calculate weekly holiday count for the month based on employee's weeklyHoliday
       let weeklyHolidayCount = 0;
       const weeklyHolidays = employee.weeklyHoliday || [];  // e.g., ['Sun']
       const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
       const weeklyHolidayDays = weeklyHolidays.map(day => dayNames.indexOf(day)).filter(day => day !== -1);  // Convert to day numbers (0=Sun, etc.)

       for (let d = 1; d <= totalMonthDays; d++) {
         const currentDate = new Date(year, month - 1, d);
         const dayOfWeek = currentDate.getDay();  // 0=Sun, 1=Mon, etc.
         if (weeklyHolidayDays.includes(dayOfWeek)) {
           weeklyHolidayCount++;
         }
       }

       const finalTotalWeeklyHolidays = weeklyHolidayCount;  // Override frontend value

       // Fetch company holidays for the month
       const companyHolidays = await Holiday.find({
         company: new mongoose.Types.ObjectId(companyId),
         date: { $gte: new Date(year, month - 1, 1), $lte: new Date(year, month, 0, 23, 59, 59, 999) }
       });
       const finalTotalCompanyHolidays = companyHolidays.length;  // Override frontend value if needed

       // Base salary
       const baseSalary = parseFloat(employee.salary) || 0;
       const pfPercentage = parseFloat(employee.pfPercentage) || 0;
       const esicPercentage = parseFloat(employee.esicPercentage) || 0;

       // Calculate per-day rate and proportional grossSalary
       const perDayRate = baseSalary / totalMonthDays;
       const effectiveWorkingDays = finalTotalWorkingDays + (finalTotalHalfDays * 0.5);
       const paidHolidayDays = finalTotalWeeklyHolidays + finalTotalCompanyHolidays;
       const totalPaidDays = effectiveWorkingDays + paidHolidayDays;
       const grossSalary = totalPaidDays * perDayRate;

       // Calculate PF and ESIC on base salary
       if (pfPercentage > 0) {
         const pfAmount = (baseSalary * pfPercentage) / 100;
         if (pfAmount > 0) {
           deductionsArray.push({
             type: 'PF (Provident Fund)',
             amount: pfAmount
           });
           console.log(`Added PF deduction: ${pfAmount}`);
         }
       }
       if (esicPercentage > 0) {
         const esicAmount = (baseSalary * esicPercentage) / 100;
         if (esicAmount > 0) {
           deductionsArray.push({
             type: 'ESIC (Employees\' State Insurance)',
             amount: esicAmount
           });
           console.log(`Added ESIC deduction: ${esicAmount}`);
         }
       }

       // totalDeductionsManual
       const totalDeductionsManual = deductionsArray.reduce((sum, ded) => sum + ded.amount, 0);
       const totalIncomes = incomesArray.reduce((sum, inc) => sum + inc.amount, 0);

       // netSalary
       const netSalary = grossSalary + totalIncomes - totalDeductionsManual;

       // Save payroll
       const payroll = new Payroll({
         company: new mongoose.Types.ObjectId(companyId),
         employee: employeeId,
         salary: baseSalary,
         weeklyHoliday: employee.weeklyHoliday || [],
         totalWorkingDays: finalTotalWorkingDays,
         totalHalfDays: finalTotalHalfDays,
         paidLeaves: 0,
         holidayCount: paidHolidayDays,
         deductions: deductionsArray,
         incomes: incomesArray,
         totalDeductions: totalDeductionsManual,
         totalIncomes,
         netSalary,
         payrollMonth: finalPayrollMonth,
       });

       await payroll.save();

       // Mark advances as deducted
       if (undeductedAdvances.length > 0) {
         const updatePromises = undeductedAdvances.map(async (adv) => {
           await SalaryAdvance.findByIdAndUpdate(adv._id, { deductedInPayroll: payroll._id });
         });
         await Promise.all(updatePromises);
       }

       // Populate and respond
       await payroll.populate('employee', 'firstName lastName salary department');

       const advanceDeductions = deductionsArray.filter(ded => ded.type === 'Salary Advance');
       const totalAdvancesDeducted = advanceDeductions.reduce((sum, ded) => sum + ded.amount, 0);

       const pfDeduction = deductionsArray.find(ded => ded.type === 'PF (Provident Fund)') || { amount: 0 };
       const esicDeduction = deductionsArray.find(ded => ded.type === 'ESIC (Employees\' State Insurance)') || { amount: 0 };

       res.status(201).json({
         message: 'Salary slip generated successfully',
         payroll,
         summary: {
           baseSalary,
           grossSalary,
           perDayRate,
           effectiveWorkingDays,
           paidHolidayDays,
           totalPaidDays,
           deductions: deductionsArray,
           advancesDeducted: advanceDeductions,
           totalAdvancesDeducted,
           pfAmount: pfDeduction.amount,
           esicAmount: esicDeduction.amount,
           totalDeductionsManual,
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

exports.getCompanyPayrollHistory = async (req, res) => {
  try {
    let companyId = req.query.companyId || req.user.companyId || req.user.id;  // Allow query param (e.g., for superadmin); default to user's company

    if (!companyId) {
      return res.status(400).json({ message: 'companyId is required' });
    }

    const { year, month } = req.query;  // Optional filters

    const filters = { company: companyId };
    if (year && month) {
      const monthStr = month.toString().padStart(2, '0');
      filters.payrollMonth = `${year}-${monthStr}`;
    }

    // Fetch payrolls with employee data (no populate for department since schema doesn't support it)
    const payrolls = await Payroll.find(filters)
      .populate('employee', 'teamMemberName name employeeId department')  // Populate employee but not department
      .sort({ payrollMonth: -1, createdAt: -1 })  // Recent months first
      .limit(100);  // Reasonable limit

    // Collect all unique department IDs from all employees
    const allDeptIds = [];
    payrolls.forEach(payroll => {
      if (payroll.employee && Array.isArray(payroll.employee.department)) {
        allDeptIds.push(...payroll.employee.department);
      }
    });
    const uniqueDeptIds = [...new Set(allDeptIds)];  // Remove duplicates

    // Fetch department names for these IDs (only if there are IDs)
    let deptMap = new Map();
    if (uniqueDeptIds.length > 0) {
      const departments = await mongoose.connection.db.collection('departments').find({
        _id: { $in: uniqueDeptIds.map(id => new mongoose.Types.ObjectId(id)) }
      }).project({ name: 1 }).toArray();  // Fetch only name field

      // Create a map of ID (string) to name
      departments.forEach(dept => {
        deptMap.set(dept._id.toString(), dept.name || 'Unknown Dept');
      });
    }

    // Replace department IDs with names in each payroll
    const enhancedPayrolls = payrolls.map(payroll => {
      const payrollObj = payroll.toObject();
      if (payrollObj.employee && Array.isArray(payrollObj.employee.department)) {
        // Replace IDs with names using the map
        payrollObj.employee.department = payrollObj.employee.department.map(deptId => 
          deptMap.get(deptId) || 'Unknown Dept'
        );
      }
      return payrollObj;
    });

    // UPDATED: Fix ObjectId constructor in aggregation pipeline (already correct in your code)
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
        pipeline: [{ $project: { teamMemberName: 1, department: 1 } }]  // ✅ Ensure teamMemberName is included here too
      } },
      { $unwind: '$employee' },
      { $sort: { totalPending: -1 } },
      { $limit: 10 }  // Top 10 employees with pending advances
    ]);

    // NEW: Enhance each payroll with employee-specific pending advances (optional, for detailed view)
    const finalPayrolls = await Promise.all(enhancedPayrolls.map(async (payroll) => {
      const employeePendingAdvances = await SalaryAdvance.find({
        company: companyId,
        employee: payroll.employee._id,
        deductedInPayroll: null
      }).select('amount').lean();

      const totalEmployeePending = employeePendingAdvances.reduce((sum, adv) => sum + adv.amount, 0);

      return {
        ...payroll,
        employeePendingAdvances: totalEmployeePending  // NEW: Per-employee pending for this payroll record
      };
    }));

    res.json({
      message: `Company payroll history for ${companyId}`,
      companyId,
      payrolls: finalPayrolls,  // Enhanced with department names and pending advances
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



// NEW: Get payroll by ID (company-scoped)
exports.getPayrollById = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.companyId || req.user.id;

    if (!id) {
      return res.status(400).json({ message: 'Payroll ID is required' });
    }

    // Find payroll by ID and company
    const payroll = await Payroll.findOne({ 
      _id: id, 
      company: new mongoose.Types.ObjectId(companyId) 
    }).populate('employee', 'teamMemberName name employeeId department salary pfPercentage esicPercentage weeklyHoliday');

    if (!payroll) {
      return res.status(404).json({ message: 'Payroll not found or access denied' });
    }

    // Calculate totals (similar to other methods)
    const totalDeductionsManual = payroll.deductions.reduce((sum, ded) => sum + ded.amount, 0);
    const totalIncomes = payroll.incomes.reduce((sum, inc) => sum + inc.amount, 0);

    // Optional: Fetch pending advances for this employee (for awareness)
    const pendingAdvances = await SalaryAdvance.find({
      company: new mongoose.Types.ObjectId(companyId),
      employee: payroll.employee._id,
      deductedInPayroll: null
    }).select('amount date notes').sort({ createdAt: -1 }).limit(5);

    const totalPendingAdvances = pendingAdvances.reduce((sum, adv) => sum + adv.amount, 0);

    res.json({
      message: 'Payroll retrieved successfully',
      payroll,
      summary: {
        totalDeductions: totalDeductionsManual,
        totalIncomes,
        netSalary: payroll.netSalary,
        pendingAdvances,
        totalPendingAdvances
      }
    });
  } catch (error) {
    console.error('Get payroll by ID error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

