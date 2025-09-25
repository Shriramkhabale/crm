const SalaryAdvance = require('../models/SalaryAdvance');
const Employee = require('../models/Employee');

// Controller: Create a new advance (supports different employee and approvedBy via body)
exports.createAdvance = async (req, res) => {
  try {
    console.log('Request body:', req.body);  // Debug: Log incoming body (remove in production)
    console.log('req.user:', req.user);  // Debug: Check auth (remove in production)

    // Safety check: Ensure auth ran (req.user exists)
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required. Please log in.' });
    }

    const { amount: amountStr, notes, employee: employeeIdFromBody, approvedBy: approvedByFromBody } = req.body;
    const companyId = req.user.companyId || req.user.userId; 

    // Parse amount to Number
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ message: 'Valid amount (positive number) is required' });
    }

    // Use body values if provided; fallback for self-creation
    const employeeId = employeeIdFromBody || req.user.id;  // Target employee (different from approver possible)
    const approvedBy = approvedByFromBody || req.user.id;  // Approver (logged-in user by default)

    if (!employeeId || !approvedBy) {
      return res.status(400).json({ message: 'employeeId and approvedBy are required (in body or token)' });
    }

    // Verify target employee exists in company
    const employee = await Employee.findOne({ _id: employeeId, company: companyId });
    console.log("employeeId",employeeId);
    console.log("companyId",companyId);
    console.log("approvedBy",approvedBy);
    
    
    if (!employee) {
      return res.status(404).json({ message: 'Target employee not found in the company' });
    }

    // Verify approver exists in company
    const approver = await Employee.findOne({ _id: approvedBy, company: companyId });
    if (!approver) {
      return res.status(404).json({ message: 'Approver not found in the company' });
    }



    // Optional: Check limits on target employee's undeducted advances (<= 50% of their salary)
    const undeductedAdvances = await SalaryAdvance.find({
      employee: employeeId,
      deductedInPayroll: null
    });
    const totalUndeducted = undeductedAdvances.reduce((sum, adv) => sum + adv.amount, 0);
    if (totalUndeducted + amount > parseFloat(employee.salary) * 0.5) {
      return res.status(400).json({ message: `Total undeducted advances for ${employee.teamMemberName} cannot exceed 50% of their salary` });
    }

    const advance = new SalaryAdvance({
      company: companyId,
      employee: employeeId,  // Can be different from approvedBy
      amount,
      approvedBy,  // Can be different from employee
      notes,
      deductedInPayroll: null  // Initially undeducted
    });

    await advance.save();
    await advance.populate('employee approvedBy', 'teamMemberName email');

    console.log('Advance created:', advance._id);  // Debug (remove in production)

    res.status(201).json({
      message: 'Advance created successfully',
      advance
    });
  } catch (error) {
    console.error('Create advance error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Controller: Get advances for a specific employee (by employee ID)
exports.getAdvancesByEmployee = async (req, res) => {
  try {
    // Safety check: Ensure auth ran
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const { employeeId } = req.params;
    const companyId = req.user.companyId || req.user.userId;

    if (!employeeId) {
      return res.status(400).json({ message: 'employeeId is required' });
    }

    // Verify access: Requester must be the employee themselves or an admin in the same company
    const employee = await Employee.findOne({ _id: employeeId, company: companyId });
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found in your company' });
    }

   

    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const advances = await SalaryAdvance.find({ employee: employeeId, company: companyId })
      .populate('employee', 'teamMemberName email')
      .populate('approvedBy', 'teamMemberName')
      .populate('deductedInPayroll', 'payrollMonth netSalary')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await SalaryAdvance.countDocuments({ employee: employeeId, company: companyId });

    res.json({
      message: 'Advances retrieved successfully',
      advances,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Get advances by employee error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Controller: Get all advances for company (admin view only)
exports.getCompanyAdvances = async (req, res) => {
  try {
    // Safety check: Ensure auth ran
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const companyId = req.user.companyId || req.user.userId;
    const { employeeId, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const filters = { company: companyId };
    if (employeeId) filters.employee = employeeId;

    const advances = await SalaryAdvance.find(filters)
      .populate('employee', 'teamMemberName email department')
      .populate('approvedBy', 'teamMemberName')
      .populate('deductedInPayroll', 'payrollMonth netSalary')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await SalaryAdvance.countDocuments(filters);

    res.json({
      message: 'Company advances retrieved successfully',
      advances,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Get company advances error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
