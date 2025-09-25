const ProjectCustomStatus = require('../models/ProjectCustomStatus');  // Matches your require
const ProjectMgnt = require('../models/ProjectMgnt');  // NEW: For delete validation (assigned projects)
const Employee = require('../models/Employee');  // For getCompanyIdFromUser  

// Helper to get company ID from user (from previous controllers)
async function getCompanyIdFromUser  (user) {
  if (user.role === 'company') {
    return user.userId; // userId is companyId
  } else {
    const employee = await Employee.findById(user.userId).select('company');
    if (!employee) throw new Error('Employee not found');
    return employee.company.toString();
  }
}

// Create a new custom status
exports.createStatus = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser  (req.user);

    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Status name is required' });
    }

    // Validate unique name per company (case-insensitive)
    const existingStatus = await ProjectCustomStatus.findOne({ 
      company, 
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } 
    });
    if (existingStatus) {
      return res.status(400).json({ message: 'Status name must be unique for your company' });
    }

    const status = new ProjectCustomStatus({
      company,
      name: name.trim(),
    });

    await status.save();

    res.status(201).json({ message: 'Custom status created successfully', status });
  } catch (error) {
    console.error('Create status error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all custom statuses for the company
exports.getAllStatuses = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser  (req.user);

    const statuses = await ProjectCustomStatus.find({ company }).sort({ createdAt: -1 });

    res.json({ statuses });
  } catch (error) {
    console.error('Get statuses error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get status by ID (scoped to company)
exports.getStatusById = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser  (req.user);
    const { id } = req.params;

    const status = await ProjectCustomStatus.findOne({ _id: id, company });

    if (!status) {
      return res.status(404).json({ message: 'Status not found' });
    }

    res.json({ status });
  } catch (error) {
    console.error('Get status by ID error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update status by ID (scoped to company)
exports.updateStatus = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser  (req.user);
    const { id } = req.params;

    const status = await ProjectCustomStatus.findOne({ _id: id, company });
    if (!status) {
      return res.status(404).json({ message: 'Status not found' });
    }

    const { name } = req.body;  // Only name (other fields removed)

    // Validate unique name if changed
    if (name && name.trim() !== status.name) {
      const existingStatus = await ProjectCustomStatus.findOne({ 
        company, 
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
        _id: { $ne: id }  // Exclude current
      });
      if (existingStatus) {
        return res.status(400).json({ message: 'Status name must be unique for your company' });
      }
      status.name = name.trim();
    }

    await status.save();

    res.json({ message: 'Status updated successfully', status });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete status by ID (scoped to company; prevent if assigned to projects)
exports.deleteStatus = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser  (req.user);
    const { id } = req.params;

    const status = await ProjectCustomStatus.findOne({ _id: id, company });
    if (!status) {
      return res.status(404).json({ message: 'Status not found' });
    }

    // Prevent deletion if assigned to any project
    const assignedProjects = await ProjectMgnt.find({ status: id }).countDocuments();
    if (assignedProjects > 0) {
      return res.status(400).json({ message: 'Cannot delete status assigned to projects. Reassign first.' });
    }

    await ProjectCustomStatus.findByIdAndDelete(id);

    res.json({ message: 'Status deleted successfully' });
  } catch (error) {
    console.error('Delete status error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
