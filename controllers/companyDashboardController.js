const Company = require('../models/Company');  // Adjust path
const Employee = require('../models/Employee');
const Task = require('../models/Task');
const SupportTicket = require('../models/SupportTicket');
const mongoose = require('mongoose');


// GET /api/companydashboard/employees - Fetch all employees for the company
exports.getEmployees = async (req, res) => {
  console.log("req", req);
  
  try {
    const companyId = req.user.userId;
    
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    // Query employees by company (String field)
    const employees = await Employee.find({ company: companyId })
      .select('-password -adharImage -panImage')  // Exclude sensitive fields
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Employee.countDocuments({ company: companyId });

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

// GET /api/companydashboard/tasks - Fetch all tasks for company (incl. branches)
exports.getTasks = async (req, res) => {
  try {
    const companyId = req.user.userId;
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    // First, get company and its branches
    const company = await Company.findById(companyId).populate('branches', 'businessName address businessEmail');
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    const branchIds = company.branches.map(b => b._id);  // ObjectIds from populated branches
    const allCompanyIds = [new mongoose.Types.ObjectId(companyId), ...branchIds.map(id => new mongoose.Types.ObjectId(id))];

    // Query tasks by company or branch (ObjectId fields)
    const tasks = await Task.find({
      $or: [
        { company: new mongoose.Types.ObjectId(companyId) },
        { branch: { $in: branchIds } }
      ]
    })
      .populate('assignedTo', 'teamMemberName email department')  // Populate assignees
      .populate('createdBy', 'teamMemberName email')  // Populate creator
      .populate('department', 'name')  // If Department model exists; adjust field
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Task.countDocuments({
      $or: [
        { company: new mongoose.Types.ObjectId(companyId) },
        { branch: { $in: branchIds } }
      ]
    });

    res.json({
      success: true,
      data: tasks,
      branches: company.branches,  // Include branches info if any
      pagination: { total, page: parseInt(page), limit: parseInt(limit) }
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/companydashboard/support-tickets - Fetch all support tickets for company
exports.getSupportTickets = async (req, res) => {
  try {
    const companyId =req.user.userId;
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    // Query tickets by companyId (String field)
    const tickets = await SupportTicket.find({ companyId: companyId.toString() })  // Convert to string if needed
      .populate('assignedTo', 'teamMemberName email')  // If assignedTo is Employee ID (string)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await SupportTicket.countDocuments({ companyId: companyId.toString() });

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

// GET /api/companydashboard/branches - Fetch branches if main company
exports.getBranches = async (req, res) => {
  try {
    const companyId = req.user.userId;

    const company = await Company.findById(companyId).populate('branches', 'businessName businessEmail address businessPhone isBranch parentCompanyId');
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    if (company.isBranch) {
      return res.json({
        success: true,
        data: [],  // Branches don't have sub-branches
        message: 'This is a branch; no sub-branches available'
      });
    }

    // Filter populated branches to ensure they are actual branches
    const branches = company.branches.filter(b => b.isBranch === true);

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
