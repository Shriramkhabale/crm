const Leave = require('../models/Leave');
const Employee = require('../models/Employee');
const Company = require('../models/Company');
const Attendance = require('../models/Attendance');
const mongoose = require('mongoose');


exports.createLeave = async (req, res) => {
  try {
    const { company, employee, reason, rejectionReason, fromDate, toDate, leaveType = 'unpaid' } = req.body;

    // Validate employee belongs to company
    const emp = await Employee.findOne({ _id: employee, company });
    if (!emp) {
      return res.status(400).json({ message: 'Employee not found in the specified company' });
    }

    // Validate dates
    if (new Date(fromDate) > new Date(toDate)) {
      return res.status(400).json({ message: "'From Date' cannot be after 'To Date'" });
    }

    // Validate leaveType
 

    const leave = new Leave({
      company,
      employee,
      reason,
      rejectionReason,
      fromDate,
      toDate,
      status: 'Pending',
      leaveType
    });

    await leave.save();

    res.status(201).json({ message: 'Leave request created', leave });
  } catch (error) {
    console.error('Create leave error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.updateLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, fromDate, toDate, contact, leaveType } = req.body;
    // Find the leave request
    const leave = await Leave.findById(id);
    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found' });
    }
    console.log("req.user leave update--",req.user);
    
    // Optional: Check if the user is authorized to update this leave (e.g., only the employee who created it)
    if (leave.employee.toString() !== req.user.employeeId || req.user.userId) {
      return res.status(403).json({ message: 'Not authorized to update this leave request' });
    }
    // Optional: Prevent updates if status is not 'Pending'
    if (leave.status !== 'Pending') {
      return res.status(400).json({ message: 'Cannot update leave request that is not pending' });
    }
    // Update the leave request
    const updatedLeave = await Leave.findByIdAndUpdate(
      id,
      {
        reason,
        fromDate,
        toDate,
        contact,
        leaveType
      },
      { new: true, runValidators: true }
    );
    res.json({ message: 'Leave request updated successfully', leave: updatedLeave });
  } catch (error) {
    console.error('Update leave error:', error);
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


// exports.updateLeaveStatus = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { status } = req.body;

//     if (!['Pending', 'Approved', 'Rejected'].includes(status)) {
//       return res.status(400).json({ message: 'Invalid status value' });
//     }

//     const leave = await Leave.findByIdAndUpdate(id, { status }, { new: true });

//     if (!leave) {
//       return res.status(404).json({ message: 'Leave request not found' });
//     }

//     res.json({ message: 'Leave status updated', leave });
//   } catch (error) {
//     console.error('Update leave status error:', error);
//     res.status(500).json({ message: 'Server error', error: error.message });
//   }
// };



exports.updateLeaveStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, approvedDates, rejectionReason } = req.body;

    if (!['Pending', 'Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value. Must be "Pending", "Approved", or "Rejected".' });
    }

    const leave = await Leave.findById(id);
    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    // Handle rejection reason if provided
    if (status === 'Rejected' && rejectionReason) {
      leave.rejectionReason = rejectionReason;
    }

    // NEW/FIXED: Handle partial/full approval with proper UTC date-only parsing
    if (status === 'Approved') {
      const company = leave.company;
      const employee = leave.employee;
      const leaveType = leave.leaveType;  // 'paid' or 'unpaid'
      const attendanceStatus = leaveType === 'paid' ? 'pl' : 'ul';

      let datesToApprove = [];

      const fromDate = new Date(leave.fromDate);
      const toDate = new Date(leave.toDate);
      fromDate.setHours(0, 0, 0, 0);  // Normalize to UTC midnight
      toDate.setHours(0, 0, 0, 0);

      // Calculate total days in range (inclusive)
      const totalDays = Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24)) + 1;
      console.log(`Leave range: ${fromDate.toISOString().split('T')[0]} to ${toDate.toISOString().split('T')[0]} (${totalDays} days)`);

      // If approvedDates provided (partial), use them
      if (approvedDates && Array.isArray(approvedDates) && approvedDates.length > 0) {
        console.log(`Processing partial approval for ${approvedDates.length} dates:`, approvedDates);

        // FIXED: Parse each as UTC midnight (date-only)
        datesToApprove = approvedDates
          .map(dateStr => {
            // Ensure dateStr is valid (YYYY-MM-DD or ISO)
            if (!dateStr || typeof dateStr !== 'string') return null;
            
            // Parse as UTC midnight: "2024-01-18" → "2024-01-18T00:00:00.000Z"
            const utcDateStr = dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00.000Z`;
            const date = new Date(utcDateStr);
            
            // Validate: Not NaN, within range, date-only
            if (isNaN(date.getTime())) {
              console.warn(`Invalid date: ${dateStr}`);
              return null;
            }
            
            // Normalize to UTC midnight
            date.setUTCHours(0, 0, 0, 0);
            
            // Check range (UTC midnight comparison)
            const rangeFrom = new Date(fromDate);
            rangeFrom.setUTCHours(0, 0, 0, 0);
            const rangeTo = new Date(toDate);
            rangeTo.setUTCHours(0, 0, 0, 0);
            
            return (date >= rangeFrom && date <= rangeTo) ? date : null;
          })
          .filter(Boolean);  // Remove null/invalid

        console.log(`Valid approved dates after filtering:`, datesToApprove.map(d => d.toISOString().split('T')[0]));

        if (datesToApprove.length === 0) {
          return res.status(400).json({ 
            message: 'No valid dates provided for approval. Dates must be in YYYY-MM-DD format and within leave range.' 
          });
        }

        // Store approved dates (UTC midnight)
        leave.approvedDates = datesToApprove;

        // Check if partial
        if (datesToApprove.length < totalDays) {
          leave.status = 'Partially Approved';
        } else {
          leave.status = 'Approved';
        }
      } else {
        // Full approval: Generate all days in range
        console.log('Processing full approval for all days');
        
        datesToApprove = [];
        let currentDate = new Date(fromDate);  // Clone to avoid mutation
        currentDate.setUTCHours(0, 0, 0, 0);
        
        while (currentDate <= toDate) {
          datesToApprove.push(new Date(currentDate));  // Clone each
          currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        }

        console.log(`Generated ${datesToApprove.length} dates for full approval:`, datesToApprove.map(d => d.toISOString().split('T')[0]));

        // Store all approved dates
        leave.approvedDates = datesToApprove;
        leave.status = 'Approved';
      }

      // Create/update attendance for each approved date (date-only UTC)
      for (const approvedDate of datesToApprove) {
        const dateOnly = new Date(approvedDate);
        dateOnly.setUTCHours(0, 0, 0, 0);  // Ensure UTC midnight

        const attendance = await Attendance.findOneAndUpdate(
          { company, employee, date: dateOnly },
          {
            company,
            employee,
            date: dateOnly,  // UTC midnight (date-only)
            status: attendanceStatus,
            leaveType,
            leaveRequestId: id,
            inTime: null,
            outTime: null,
            inLocation: null,
            outLocation: null,
            inPhoto: null,
            outPhoto: null,
            workingTime: 0
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        console.log(`✅ Created/Updated attendance for ${dateOnly.toISOString().split('T')[0]}: status=${attendanceStatus}, leaveRequestId=${id}`);
      }

      console.log(`Total attendance records created/updated: ${datesToApprove.length}`);
    } else {
      // For Rejected or Pending: Clear approvedDates and reset status
      leave.approvedDates = [];
      leave.status = status;
      console.log(`Leave ${id} set to ${status} (no attendance changes)`);
    }

    await leave.save();

    // Populate for response
    await leave.populate('employee', 'firstName lastName teamMemberName');
    await leave.populate('company', 'name');

    res.json({ 
      message: `Leave ${leave.status.toLowerCase()} successfully`, 
      leave 
    });
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




// NEW: Get employee's all leaves summary (grouped by paid/unpaid)
exports.getEmployeeLeavesSummary = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { status } = req.query;  // Optional filter: e.g., ?status=Approved (or Partially Approved)

    // Validate employeeId
    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({ message: 'Invalid employee ID' });
    }

    // Base filter
    const filter = { employee: employeeId };
    if (status) {
      filter.status = status;  // e.g., 'Approved', 'Partially Approved', etc.
    }

    // Fetch all leaves for employee
    const leaves = await Leave.find(filter)
      .populate('company', 'name')  // Optional: Company details
      .sort({ appliedDate: -1 });  // Recent first

    if (!leaves || leaves.length === 0) {
      return res.json({ 
        message: 'No leaves found for this employee',
        paidLeaves: [],
        unpaidLeaves: [],
        totalPaidDays: 0,
        totalUnpaidDays: 0
      });
    }

    // Group by leaveType and calculate total approved days
    const paidLeaves = [];
    const unpaidLeaves = [];
    let totalPaidDays = 0;
    let totalUnpaidDays = 0;

    leaves.forEach(leave => {
      const leaveData = {
        id: leave._id,
        reason: leave.reason,
        fromDate: leave.fromDate,
        toDate: leave.toDate,
        leaveType: leave.leaveType,
        status: leave.status,
        appliedDate: leave.appliedDate,
        approvedDates: leave.approvedDates || [],  // Array of approved dates (for partial)
        company: leave.company ? leave.company.name : null
      };

      // Calculate approved days (from approvedDates or full range if fully approved)
      let approvedDaysCount = 0;
      if (leave.status === 'Approved') {
        // Full range
        const from = new Date(leave.fromDate);
        const to = new Date(leave.toDate);
        approvedDaysCount = Math.ceil((to - from) / (1000 * 60 * 60 * 24)) + 1;
      } else if (leave.status === 'Partially Approved' && leave.approvedDates && leave.approvedDates.length > 0) {
        approvedDaysCount = leave.approvedDates.length;
      }

      leaveData.approvedDays = approvedDaysCount;

      if (leave.leaveType === 'paid') {
        paidLeaves.push(leaveData);
        totalPaidDays += approvedDaysCount;
      } else {
        unpaidLeaves.push(leaveData);
        totalUnpaidDays += approvedDaysCount;
      }
    });

    res.json({
      message: `Employee leaves summary fetched successfully`,
      employeeId,
      paidLeaves,  // Array of paid leave objects
      unpaidLeaves,  // Array of unpaid leave objects
      totalPaidDays,  // Total approved paid leave days
      totalUnpaidDays,  // Total approved unpaid leave days
      totalLeaves: leaves.length
    });
  } catch (error) {
    console.error('Get employee leaves summary error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
