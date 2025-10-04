const Leave = require('../models/Leave');
const Employee = require('../models/Employee');
const Company = require('../models/Company');

exports.createLeave = async (req, res) => {
  try {
    const { company, employee, reason, rejectionReason, fromDate, toDate } = req.body;

    // Validate company and employee exist and employee belongs to company
    const emp = await Employee.findOne({ _id: employee, company });
    if (!emp) {
      return res.status(400).json({ message: 'Employee not found in the specified company' });
    }

    // Validate dates
    if (new Date(fromDate) > new Date(toDate)) {
      return res.status(400).json({ message: "'From Date' cannot be after 'To Date'" });
    }

    const leave = new Leave({
      company,
      employee,
      reason,
      rejectionReason,
      fromDate,
      toDate,
      status: 'Pending',
    });

    await leave.save();

    res.status(201).json({ message: 'Leave request created', leave });
  } catch (error) {
    console.error('Create leave error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getLeaves = async (req, res) => {
  try {
    const { company, employee, status } = req.query;
    const filter = {};

    if (company) filter.company = company;
    if (employee) filter.employee = employee;
    if (status) filter.status = status;

    const leaves = await Leave.find(filter)
      .populate('employee', 'name')
      .populate('company', 'name')
      .sort({ appliedDate: -1 });

    res.json({ leaves });
  } catch (error) {
    console.error('Get leaves error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getLeaveById = async (req, res) => {
  try {
    const { id } = req.params;

    const leave = await Leave.findById(id)
      .populate('employee', 'name')
      .populate('company', 'name');

    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    res.json({ leave });
  } catch (error) {
    console.error('Get leave by ID error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


exports.updateLeaveStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['Pending', 'Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    const leave = await Leave.findByIdAndUpdate(id, { status }, { new: true });

    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    res.json({ message: 'Leave status updated', leave });
  } catch (error) {
    console.error('Update leave status error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.deleteLeave = async (req, res) => {
  try {
    const { id } = req.params;

    const leave = await Leave.findByIdAndDelete(id);

    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    res.json({ message: 'Leave request deleted' });
  } catch (error) {
    console.error('Delete leave error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
