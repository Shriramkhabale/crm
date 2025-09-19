const LeaveType = require('../models/LeaveType');

// Create a new leave type
exports.createLeaveType = async (req, res) => {
  try {
    const { company, leaveType } = req.body;

    if (!company || !leaveType) {
      return res.status(400).json({ message: 'Company ID and leaveType are required' });
    }

    // Optional: Check if leaveType already exists for the company
    const existing = await LeaveType.findOne({ company, leaveType });
    if (existing) {
      return res.status(400).json({ message: 'Leave type already exists for this company' });
    }

    const leaveTypeDoc = new LeaveType({ company, leaveType });
    await leaveTypeDoc.save();

    res.status(201).json({ message: 'Leave type created', leaveType: leaveTypeDoc });
  } catch (error) {
    console.error('Create leave type error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all leave types for a company
exports.getLeaveTypesByCompany = async (req, res) => {
  try {
    const { companyId } = req.params;

    const leaveTypes = await LeaveType.find({ company: companyId }).sort({ createdAt: -1 });

    res.json({ leaveTypes });
  } catch (error) {
    console.error('Get leave types error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get leave type by ID
exports.getLeaveTypeById = async (req, res) => {
  try {
    const { id } = req.params;

    const leaveType = await LeaveType.findById(id);
    if (!leaveType) {
      return res.status(404).json({ message: 'Leave type not found' });
    }

    res.json({ leaveType });
  } catch (error) {
    console.error('Get leave type by ID error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update leave type by ID
exports.updateLeaveType = async (req, res) => {
  try {
    const { id } = req.params;
    const { leaveType } = req.body;

    if (!leaveType) {
      return res.status(400).json({ message: 'leaveType is required' });
    }

    const updated = await LeaveType.findByIdAndUpdate(id, { leaveType }, { new: true, runValidators: true });
    if (!updated) {
      return res.status(404).json({ message: 'Leave type not found' });
    }

    res.json({ message: 'Leave type updated', leaveType: updated });
  } catch (error) {
    console.error('Update leave type error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete leave type by ID
exports.deleteLeaveType = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await LeaveType.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: 'Leave type not found' });
    }

    res.json({ message: 'Leave type deleted' });
  } catch (error) {
    console.error('Delete leave type error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
