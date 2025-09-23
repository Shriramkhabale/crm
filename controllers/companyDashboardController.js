const Company = require('../models/Company');
const Employee = require('../models/Employee');
const Task = require('../models/Task');
const SupportTicket = require('../models/SupportTicket');
const mongoose = require('mongoose');

// GET /api/companydashboard/employees
exports.getEmployees = async (req, res) => {
  console.log("req.user in employees:", req.user);  // Debug: Check userId/role
  
  try {
    const companyIdStr = req.user.userId;  // String from token (company _id)
    if (!companyIdStr) {
      return res.status(400).json({ success: false, message: 'User  ID not found in token' });
    }

    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * parseInt(limit);

    // Query employees by company (String field in Employee schema)
    const employees = await Employee.find({ company: companyIdStr })
      .select('-password -adharImage -panImage')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Employee.countDocuments({ company: companyIdStr });
    console.log(`Employees found for company ${companyIdStr}: ${total}`);  // Debug count

    res.json({
      success: true,
      data: employees,
      pagination: { total, page: parseInt(page), limit: parseInt(limit) }
    });
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/companydashboard/tasks (Key Fixes: Safe ObjectId, logs, branch safety)
exports.getTasks = async (req, res) => {
  console.log("req.user in tasks:", req.user);  // Debug: userId/role
  
  try {
    const companyIdStr = req.user.userId;  // String from token
    if (!companyIdStr) {
      return res.status(400).json({ success: false, message: 'User  ID not found in token' });
    }

    // Validate and convert to ObjectId for Task queries
    if (!mongoose.Types.ObjectId.isValid(companyIdStr)) {
      return res.status(400).json({ success: false, message: 'Invalid company ID format' });
    }
    const companyId = new mongoose.Types.ObjectId(companyIdStr);

    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * parseInt(limit);

    // Get company and branches safely
    const company = await Company.findById(companyId).populate('branches', 'businessName address businessEmail isBranch');
    if (!company) {
      console.log('Company not found:', companyIdStr);
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    // Safe branch extraction (filter valid ObjectIds)
    const branchIds = (company.branches || [])
      .map(b => b?._id)
      .filter(id => id && mongoose.Types.ObjectId.isValid(id.toString()))
      .map(id => new mongoose.Types.ObjectId(id.toString()));
    console.log('Branch IDs for query:', branchIds);  // Debug: See if branches exist

    // Build query: company OR branch (only add branch if IDs exist)
    const query = { company: companyId };
    if (branchIds.length > 0) {
      query.$or = [
        { company: companyId },
        { branch: { $in: branchIds } }
      ];
    }
    console.log('Task query object:', JSON.stringify(query, null, 2));  // Debug: Exact query

    // Fetch tasks
    const tasks = await Task.find(query)
      .populate('assignedTo', 'teamMemberName email department')  // Safe; matches Employee schema
      .populate('createdBy', 'teamMemberName email')  // Safe
      // Note: No .populate('department') – add if Department model exists
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Task.countDocuments(query);
    console.log(`Tasks found for company ${companyIdStr}: ${total}`);  // Debug: Count

    res.json({
      success: true,
      data: tasks,
      branches: company.branches || [],  // Safe fallback
      pagination: { total, page: parseInt(page), limit: parseInt(limit) }
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);  // Logs CastError, etc.
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/companydashboard/support-tickets
exports.getSupportTickets = async (req, res) => {
  console.log("req.user in tickets:", req.user);  // Debug
  
  try {
    const companyIdStr = req.user.userId;  // String for SupportTicket.companyId (assume String field)
    if (!companyIdStr) {
      return res.status(400).json({ success: false, message: 'User  ID not found in token' });
    }

    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * parseInt(limit);

    // Query tickets by companyId (String field)
    const tickets = await SupportTicket.find({ companyId: companyIdStr })
      .populate('assignedTo', 'teamMemberName email')  // Safe
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });
console.log("SupportTicket", SupportTicket.countDocuments({ companyId: companyIdStr }));

    const total = await SupportTicket.countDocuments({ companyId: companyIdStr });
    console.log(`Tickets found for company ${companyIdStr}: ${total}`);  // Debug

    res.json({
      success: true,
      data: tickets,
      pagination: { total, page: parseInt(page), limit: parseInt(limit) }
    });
  } catch (error) {
    console.error('Error fetching support tickets:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/companydashboard/branches
exports.getBranches = async (req, res) => {
  console.log("req.user in branches:", req.user);  // Debug
  
  try {
    const companyIdStr = req.user.userId;
    if (!companyIdStr || !mongoose.Types.ObjectId.isValid(companyIdStr)) {
      return res.status(400).json({ success: false, message: 'Invalid company ID' });
    }
    const companyId = new mongoose.Types.ObjectId(companyIdStr);

    const company = await Company.findById(companyId).populate('branches', 'businessName businessEmail address businessPhone isBranch parentCompanyId');
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    if (company.isBranch) {
      return res.json({
        success: true,
        data: [],
        message: 'This is a branch; no sub-branches available',
        total: 0
      });
    }

    // Safe filter for branches
    const branches = (company.branches || []).filter(b => b && b.isBranch === true);
    console.log(`Branches found for company ${companyIdStr}: ${branches.length}`);  // Debug

    res.json({
      success: true,
      data: branches,
      total: branches.length
    });
  } catch (error) {
    console.error('Error fetching branches:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
