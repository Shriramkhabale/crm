const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');

async function getCompanyIdFromUser(user) {
  if (user.role === 'company') {
    return user.userId; // userId is companyId
  } else {
    const employee = await Employee.findById(user.userId).select('company');
    if (!employee) throw new Error('Employee not found');
    return employee.company.toString();
  }
}

// Mark attendance with image upload support
exports.markAttendanceWithImages = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser(req.user);

    const {
      employee,
      date,
      inTime,
      inLocation,
      outTime,
      outLocation,
      status,
    } = req.body;


    console.log("req.body", req.body);

    if (!employee || !date || !inTime) {
      return res.status(400).json({ message: 'employee, date, and inTime are required' });
    }


    console.log("employee-", employee);
    console.log("company2- ", company);

    // Validate employee belongs to company
    const emp = await Employee.findOne({ _id: employee, company });
    console.log("emp", emp);

    if (!emp) {
      return res.status(400).json({ message: 'Employee not found in your company' });
    }

    // Get uploaded image URLs from Cloudinary
    const inPhotoUrl = req.files?.inPhoto?.[0]?.path || null;
    const outPhotoUrl = req.files?.outPhoto?.[0]?.path || null;

    // Calculate workingTime if outTime is provided
    let workingTime = null;
    if (outTime) {
      const inDate = new Date(inTime);
      const outDate = new Date(outTime);
      workingTime = Math.max(0, (outDate - inDate) / 1000 / 60); // minutes
    }

    // Upsert attendance record for employee and date
    const attendance = await Attendance.findOneAndUpdate(
      { company, employee, date: new Date(date).setHours(0, 0, 0, 0) },
      {
        company,
        employee,
        date: new Date(date).setHours(0, 0, 0, 0),
        inTime,
        inLocation,
        inPhoto: inPhotoUrl,
        outTime,
        outLocation,
        outPhoto: outPhotoUrl,
        workingTime,
        status: status || 'Present',
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({ message: 'Attendance marked successfully', attendance });
  } catch (error) {
    console.error('Mark attendance error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update attendance with image upload support
exports.updateAttendanceWithImages = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser(req.user);
    const { id } = req.params;
    const updateData = req.body;

    // Add uploaded image URLs if present
    if (req.files?.inPhoto?.[0]?.path) {
      updateData.inPhoto = req.files.inPhoto[0].path;
    }
    if (req.files?.outPhoto?.[0]?.path) {
      updateData.outPhoto = req.files.outPhoto[0].path;
    }

    // Find and update attendance record belonging to company
    const attendance = await Attendance.findOneAndUpdate(
      { _id: id, company },
      updateData,
      { new: true, runValidators: true }
    );

    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found or not authorized' });
    }

    res.json({ message: 'Attendance updated successfully', attendance });
  } catch (error) {
    console.error('Update attendance error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};



// Get attendance records for company (optionally filter by employee and date range)
exports.getAttendanceRecords = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser(req.user);

    const filters = { company };

    if (req.query.employee) filters.employee = req.query.employee;
    if (req.query.status) filters.status = req.query.status;

    if (req.query.startDate || req.query.endDate) {
      filters.date = {};
      if (req.query.startDate) {
        const [year, month, day] = req.query.startDate.split('-').map(Number);
        filters.date.$gte = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      }
      if (req.query.endDate) {
        const [year, month, day] = req.query.endDate.split('-').map(Number);
        filters.date.$lte = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
      }
    }

    const records = await Attendance.find(filters)
      .populate('employee', 'firstName lastName name teamMemberName')
      .sort({ date: -1 });

    res.json({ records });
  } catch (error) {
    console.error('Get attendance records error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get attendance record by ID
exports.getAttendanceById = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser(req.user);
    const { id } = req.params;

    const attendance = await Attendance.findOne({ _id: id, company })
      .populate('employee', 'firstName lastName');

    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    res.json({ attendance });
  } catch (error) {
    console.error('Get attendance by ID error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};




// Delete attendance record by ID
exports.deleteAttendance = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser(req.user);
    const { id } = req.params;

    const attendance = await Attendance.findOneAndDelete({ _id: id, company });
    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found or not authorized' });
    }

    res.json({ message: 'Attendance record deleted successfully' });
  } catch (error) {
    console.error('Delete attendance error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Add manual attendance (for HR/Admin use)
exports.addManualAttendance = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser(req.user);
    const {
      employee,
      date,
      status,
      inTime,
      outTime,
      inLocation,
      outLocation,
      notes
    } = req.body;

    // Validate required fields
    if (!employee || !date || !status) {
      return res.status(400).json({
        message: 'Employee, date, and status are required'
      });
    }

    // Validate employee belongs to company
    const emp = await Employee.findOne({ _id: employee, company });
    if (!emp) {
      return res.status(400).json({
        message: 'Employee not found in your company'
      });
    }

    // Calculate working time if both times provided
    let workingTime = null;
    if (inTime && outTime) {
      const inDate = new Date(inTime);
      const outDate = new Date(outTime);

      if (outDate <= inDate) {
        return res.status(400).json({
          message: 'Out time must be after in time'
        });
      }

      workingTime = Math.max(0, (outDate - inDate) / 1000 / 60); // minutes
    }

    // Prepare date object properly (avoid timezone issues)
    // Parse the date string as YYYY-MM-DD and create date in UTC
    const [year, month, day] = date.split('-').map(Number);
    const dateObj = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

    // Prepare attendance data
    const attendanceData = {
      company,
      employee,
      date: dateObj,
      status,
      inLocation: inLocation || 'Manual Entry',
      outLocation: outLocation || 'Manual Entry',
      workingTime
    };

    // Add times if provided
    if (inTime) {
      attendanceData.inTime = new Date(inTime);
    }
    if (outTime) {
      attendanceData.outTime = new Date(outTime);
    }

    // Check if attendance already exists for this date
    const existingAttendance = await Attendance.findOne({
      company,
      employee,
      date: dateObj
    });

    if (existingAttendance) {
      return res.status(400).json({
        message: 'Attendance already exists for this date. Please use update instead.'
      });
    }

    // Create new attendance record
    const attendance = await Attendance.create(attendanceData);

    res.status(201).json({
      message: 'Manual attendance added successfully',
      attendance
    });
  } catch (error) {
    console.error('Add manual attendance error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
};

// Bulk add manual attendance (for multiple employees or dates)
exports.addBulkManualAttendance = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser(req.user);
    const { attendanceRecords } = req.body;

    if (!Array.isArray(attendanceRecords) || attendanceRecords.length === 0) {
      return res.status(400).json({
        message: 'attendanceRecords array is required and must not be empty'
      });
    }

    const results = {
      success: [],
      failed: []
    };

    for (const record of attendanceRecords) {
      try {
        const { employee, date, status, inTime, outTime, inLocation, outLocation } = record;

        // Validate required fields
        if (!employee || !date || !status) {
          results.failed.push({
            employee,
            date,
            reason: 'Missing required fields (employee, date, or status)'
          });
          continue;
        }

        // Validate employee belongs to company
        const emp = await Employee.findOne({ _id: employee, company });
        if (!emp) {
          results.failed.push({
            employee,
            date,
            reason: 'Employee not found in company'
          });
          continue;
        }

        // Calculate working time if both times provided
        let workingTime = null;
        if (inTime && outTime) {
          const inDate = new Date(inTime);
          const outDate = new Date(outTime);

          if (outDate > inDate) {
            workingTime = Math.max(0, (outDate - inDate) / 1000 / 60); // minutes
          }
        }

        // Prepare date object properly (avoid timezone issues)
        const [year, month, day] = date.split('-').map(Number);
        const dateObj = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

        // Prepare attendance data
        const attendanceData = {
          company,
          employee,
          date: dateObj,
          status,
          inLocation: inLocation || 'Manual Entry',
          outLocation: outLocation || 'Manual Entry',
          workingTime
        };

        if (inTime) attendanceData.inTime = new Date(inTime);
        if (outTime) attendanceData.outTime = new Date(outTime);

        // Check if attendance already exists
        const existingAttendance = await Attendance.findOne({
          company,
          employee,
          date: dateObj
        });

        if (existingAttendance) {
          results.failed.push({
            employee,
            date,
            reason: 'Attendance already exists for this date'
          });
          continue;
        }

        // Create attendance record
        const attendance = await Attendance.create(attendanceData);
        results.success.push({
          employee,
          date,
          attendanceId: attendance._id
        });
      } catch (err) {
        results.failed.push({
          employee: record.employee,
          date: record.date,
          reason: err.message
        });
      }
    }

    res.status(200).json({
      message: `Processed ${attendanceRecords.length} records`,
      results
    });
  } catch (error) {
    console.error('Bulk add manual attendance error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
};

// Update manual attendance
exports.updateManualAttendance = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser(req.user);
    const { id } = req.params;
    const { employee, date, status, inTime, outTime, inLocation, outLocation } = req.body;

    // Find the attendance record
    const attendance = await Attendance.findOne({ _id: id, company });
    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    // If employee is being changed, validate the new employee
    if (employee && employee !== attendance.employee.toString()) {
      const emp = await Employee.findOne({ _id: employee, company });
      if (!emp) {
        return res.status(404).json({ message: 'Employee not found in company' });
      }
      attendance.employee = employee;
    }

    // Update fields if provided
    if (date) {
      const [year, month, day] = date.split('-').map(Number);
      const dateObj = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      attendance.date = dateObj;
    }
    if (status) attendance.status = status;
    if (inLocation !== undefined) attendance.inLocation = inLocation || 'Manual Entry';
    if (outLocation !== undefined) attendance.outLocation = outLocation || 'Manual Entry';

    // Update times
    if (inTime !== undefined) {
      attendance.inTime = inTime ? new Date(inTime) : null;
    }
    if (outTime !== undefined) {
      attendance.outTime = outTime ? new Date(outTime) : null;
    }

    // Recalculate working time if both times are present
    if (attendance.inTime && attendance.outTime) {
      const inDate = new Date(attendance.inTime);
      const outDate = new Date(attendance.outTime);

      if (outDate <= inDate) {
        return res.status(400).json({
          message: 'Out time must be after in time'
        });
      }

      attendance.workingTime = Math.max(0, (outDate - inDate) / 1000 / 60);
    } else {
      attendance.workingTime = null;
    }

    await attendance.save();

    res.status(200).json({
      message: 'Attendance updated successfully',
      attendance
    });
  } catch (error) {
    console.error('Update manual attendance error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
};

// Delete manual attendance
exports.deleteManualAttendance = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser(req.user);
    const { id } = req.params;

    const attendance = await Attendance.findOneAndDelete({ _id: id, company });

    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    res.status(200).json({
      message: 'Attendance deleted successfully'
    });
  } catch (error) {
    console.error('Delete manual attendance error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
};