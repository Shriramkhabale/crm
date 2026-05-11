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

// Punch In - for clocking in (breaks, lunch, etc.)
exports.punchIn = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser(req.user);

    let {
      employee,
      date,
      inTime,
      inLocation,
    } = req.body;

    if (!employee || !date || !inTime) {
      return res.status(400).json({ message: 'employee, date, and inTime are required' });
    }

    // Validate employee belongs to company
    const emp = await Employee.findOne({ _id: employee, company });
    if (!emp) {
      return res.status(400).json({ message: 'Employee not found in your company' });
    }

    // Get uploaded image URL
    const inPhotoUrl = req.files?.inPhoto?.[0]?.path || null;

    // Find existing attendance record for employee and date
    let attendance = await Attendance.findOne({
      company,
      employee,
      date: new Date(date).setHours(0, 0, 0, 0)
    });

    if (!attendance) {
      // First punch in of the day
      attendance = new Attendance({
        company,
        employee,
        date: new Date(date).setHours(0, 0, 0, 0),
        inTime,
        inLocation,
        inPhoto: inPhotoUrl,
        status: 'Present',
        punches: [{
          inTime,
          inLocation,
          inPhoto: inPhotoUrl,
          outTime: null,
          outLocation: null,
          outPhoto: null
        }]
      });
    } else {
      // Handle multiple punches - add new punch in
      let lastPunch = attendance.punches && attendance.punches.length > 0
        ? attendance.punches[attendance.punches.length - 1]
        : null;

      if (lastPunch && !lastPunch.outTime) {
        // Update existing incomplete punch in
        lastPunch.inTime = inTime;
        lastPunch.inLocation = inLocation;
        if (inPhotoUrl) lastPunch.inPhoto = inPhotoUrl;
      } else {
        // Add new punch in (previous punch was completed)
        attendance.punches.push({
          inTime,
          inLocation,
          inPhoto: inPhotoUrl,
          outTime: null,
          outLocation: null,
          outPhoto: null
        });
      }

      // Update main document fields
      attendance.inTime = inTime;
      attendance.inLocation = inLocation;
      if (inPhotoUrl) attendance.inPhoto = inPhotoUrl;
    }

    attendance.markModified('punches');
    await attendance.save();

    res.status(200).json({ message: 'Punched in successfully', attendance });
  } catch (error) {
    console.error('Punch in error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Punch Out - for clocking out (breaks, lunch, end of day)
exports.punchOut = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser(req.user);

    let {
      employee,
      date,
      outTime,
      outLocation,
    } = req.body;

    if (!employee || !date || !outTime) {
      return res.status(400).json({ message: 'employee, date, and outTime are required' });
    }

    // Validate employee belongs to company
    const emp = await Employee.findOne({ _id: employee, company });
    if (!emp) {
      return res.status(400).json({ message: 'Employee not found in your company' });
    }

    // Get uploaded image URL
    const outPhotoUrl = req.files?.outPhoto?.[0]?.path || null;

    // Find existing attendance record for employee and date
    const attendance = await Attendance.findOne({
      company,
      employee,
      date: new Date(date).setHours(0, 0, 0, 0)
    });

    if (!attendance) {
      return res.status(400).json({ message: 'No attendance record found for today. Please punch in first.' });
    }

    // Handle punch out - update the last incomplete punch
    let lastPunch = attendance.punches && attendance.punches.length > 0
      ? attendance.punches[attendance.punches.length - 1]
      : null;

    if (!lastPunch || lastPunch.outTime) {
      return res.status(400).json({ message: 'No active punch-in found to punch out from.' });
    }

    // Update the last punch with out time
    lastPunch.outTime = outTime;
    lastPunch.outLocation = outLocation;
    if (outPhotoUrl) lastPunch.outPhoto = outPhotoUrl;

    // Update main document fields
    attendance.outTime = outTime;
    attendance.outLocation = outLocation;
    if (outPhotoUrl) attendance.outPhoto = outPhotoUrl;

    // Recalculate total working time based on all completed punches
    let totalWorkingMinutes = 0;
    if (attendance.punches && attendance.punches.length > 0) {
      attendance.punches.forEach(p => {
        if (p.inTime && p.outTime) {
          const inD = new Date(p.inTime);
          const outD = new Date(p.outTime);
          totalWorkingMinutes += Math.max(0, (outD - inD) / 1000 / 60);
        }
      });
    }
    attendance.workingTime = totalWorkingMinutes;

    attendance.markModified('punches');
    await attendance.save();

    res.status(200).json({ message: 'Punched out successfully', attendance });
  } catch (error) {
    console.error('Punch out error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Mark attendance with image upload support
exports.markAttendanceWithImages = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser(req.user);

    let {
      employee,
      date,
      inTime,
      inLocation,
      outTime,
      outLocation,
      status,
    } = req.body;

    // Clean up FormData string conversions
    if (outTime === 'undefined' || outTime === 'null' || outTime === '') outTime = null;
    if (inTime === 'undefined' || inTime === 'null' || inTime === '') inTime = null;


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

    // Find existing attendance record for employee and date
    let attendance = await Attendance.findOne({
      company,
      employee,
      date: new Date(date).setHours(0, 0, 0, 0)
    });

    if (!attendance) {
      // First punch in of the day
      let initialWorkingTime = 0;
      if (outTime) {
        const inDate = new Date(inTime);
        const outDate = new Date(outTime);
        initialWorkingTime = Math.max(0, (outDate - inDate) / 1000 / 60); // minutes
      }

      attendance = new Attendance({
        company,
        employee,
        date: new Date(date).setHours(0, 0, 0, 0),
        inTime,
        inLocation,
        inPhoto: inPhotoUrl,
        outTime,
        outLocation,
        outPhoto: outPhotoUrl,
        workingTime: initialWorkingTime,
        status: status || 'Present',
        punches: [{
          inTime,
          inLocation,
          inPhoto: inPhotoUrl,
          outTime,
          outLocation,
          outPhoto: outPhotoUrl
        }]
      });
    } else {
      // Handle multiple punches
      let lastPunch = attendance.punches && attendance.punches.length > 0 
        ? attendance.punches[attendance.punches.length - 1] 
        : null;

      if (outTime) {
        // We are punching out (or updating an out punch)
        if (lastPunch && !lastPunch.outTime) {
          // Normal punch out for the most recent punch in
          lastPunch.outTime = outTime;
          lastPunch.outLocation = outLocation;
          if (outPhotoUrl) lastPunch.outPhoto = outPhotoUrl;
        } else if (lastPunch && lastPunch.outTime) {
          // The last punch is already completed.
          // Are we updating the last punch out, or adding a new full punch record?
          if (new Date(inTime).getTime() !== new Date(lastPunch.inTime).getTime()) {
            // New complete punch (has both in and out)
            attendance.punches.push({
              inTime,
              inLocation,
              inPhoto: inPhotoUrl,
              outTime,
              outLocation,
              outPhoto: outPhotoUrl
            });
          } else {
            // Updating the existing last punch out
            lastPunch.outTime = outTime;
            lastPunch.outLocation = outLocation;
            if (outPhotoUrl) lastPunch.outPhoto = outPhotoUrl;
          }
        } else if (!lastPunch) {
          // Legacy record with no punches array, initialize it
          attendance.punches = [{
            inTime: attendance.inTime,
            inLocation: attendance.inLocation,
            inPhoto: attendance.inPhoto,
            outTime,
            outLocation,
            outPhoto: outPhotoUrl
          }];
        }
      } else {
        // We are punching in
        if (lastPunch && lastPunch.outTime) {
          // The previous punch was completed, so this is a NEW punch in!
          attendance.punches.push({
            inTime,
            inLocation,
            inPhoto: inPhotoUrl,
            outTime: null,
            outLocation: null,
            outPhoto: null
          });
        } else if (lastPunch && !lastPunch.outTime) {
          // Updating the current punch in (e.g., photo updated or location refinement)
          lastPunch.inTime = inTime;
          lastPunch.inLocation = inLocation;
          if (inPhotoUrl) lastPunch.inPhoto = inPhotoUrl;
        } else {
          // Legacy record initialization
          attendance.punches = [{
            inTime,
            inLocation,
            inPhoto: inPhotoUrl,
            outTime: null,
            outLocation: null,
            outPhoto: null
          }];
        }
      }

      // Update main document fields
      // For outTime and outLocation, always use the latest provided (to keep top-level fields updated)
      if (outTime) attendance.outTime = outTime;
      if (outLocation) attendance.outLocation = outLocation;
      if (outPhotoUrl) attendance.outPhoto = outPhotoUrl;
      if (status) attendance.status = status;

      // Recalculate total working time based on all completed punches
      let totalWorkingMinutes = 0;
      if (attendance.punches && attendance.punches.length > 0) {
        attendance.punches.forEach(p => {
          if (p.inTime && p.outTime) {
            const inD = new Date(p.inTime);
            const outD = new Date(p.outTime);
            totalWorkingMinutes += Math.max(0, (outD - inD) / 1000 / 60);
          }
        });
      } else if (attendance.inTime && attendance.outTime) {
        // Fallback for legacy calculation
        const inD = new Date(attendance.inTime);
        const outD = new Date(attendance.outTime);
        totalWorkingMinutes = Math.max(0, (outD - inD) / 1000 / 60);
      }
      attendance.workingTime = totalWorkingMinutes;
    }

    attendance.markModified('punches');
    await attendance.save();

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

// Get punch status for an employee on a specific date
exports.getPunchStatus = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser(req.user);
    const { employee, date } = req.params;

    const emp = await Employee.findOne({ _id: employee, company });
    if (!emp) {
      return res.status(400).json({ message: 'Employee not found in your company' });
    }

    const attendance = await Attendance.findOne({
      company,
      employee,
      date: new Date(date).setHours(0, 0, 0, 0)
    });

    if (!attendance) {
      return res.json({
        status: 'not_punched_in',
        message: 'No attendance record found for this date',
        isCurrentlyIn: false,
        lastPunch: null,
        attendance: null
      });
    }

    const lastPunch = attendance.punches && attendance.punches.length > 0
      ? attendance.punches[attendance.punches.length - 1]
      : null;

    const isCurrentlyIn = lastPunch && !lastPunch.outTime;

    res.json({
      status: isCurrentlyIn ? 'punched_in' : 'punched_out',
      message: isCurrentlyIn ? 'Currently punched in' : 'Currently punched out',
      isCurrentlyIn,
      lastPunch,
      attendance: {
        id: attendance._id,
        date: attendance.date,
        totalPunches: attendance.punches ? attendance.punches.length : 0,
        workingTime: attendance.workingTime
      }
    });
  } catch (error) {
    console.error('Get punch status error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all punches for an employee on a specific date
exports.getPunches = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser(req.user);
    const { employee, date } = req.params;

    const emp = await Employee.findOne({ _id: employee, company });
    if (!emp) {
      return res.status(400).json({ message: 'Employee not found in your company' });
    }

    const attendance = await Attendance.findOne({
      company,
      employee,
      date: new Date(date).setHours(0, 0, 0, 0)
    }).populate('employee', 'firstName lastName name teamMemberName');

    if (!attendance) {
      return res.json({
        message: 'No attendance record found for this date',
        punches: [],
        attendance: null
      });
    }

    res.json({
      message: 'Punches retrieved successfully',
      attendance: {
        id: attendance._id,
        date: attendance.date,
        status: attendance.status,
        workingTime: attendance.workingTime,
        employee: attendance.employee
      },
      punches: attendance.punches || []
    });
  } catch (error) {
    console.error('Get punches error:', error);
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
      workingTime,
      punches: []
    };

    // Add times if provided
    if (inTime) {
      attendanceData.inTime = new Date(inTime);
    }
    if (outTime) {
      attendanceData.outTime = new Date(outTime);
    }
    
    // Initialize punches array for manual entry
    if (inTime || outTime) {
      attendanceData.punches.push({
        inTime: inTime ? new Date(inTime) : null,
        inLocation: inLocation || 'Manual Entry',
        outTime: outTime ? new Date(outTime) : null,
        outLocation: outLocation || 'Manual Entry'
      });
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
          workingTime,
          punches: []
        };

        if (inTime) attendanceData.inTime = new Date(inTime);
        if (outTime) attendanceData.outTime = new Date(outTime);

        if (inTime || outTime) {
          attendanceData.punches.push({
            inTime: inTime ? new Date(inTime) : null,
            inLocation: inLocation || 'Manual Entry',
            outTime: outTime ? new Date(outTime) : null,
            outLocation: outLocation || 'Manual Entry'
          });
        }

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

    // Sync punches array for manual update
    if (attendance.inTime || attendance.outTime) {
      if (!attendance.punches || attendance.punches.length === 0) {
        attendance.punches = [{
          inTime: attendance.inTime,
          inLocation: attendance.inLocation,
          outTime: attendance.outTime,
          outLocation: attendance.outLocation
        }];
      } else {
        // Just update the first punch for manual entry simplicity
        attendance.punches[0].inTime = attendance.inTime;
        attendance.punches[0].outTime = attendance.outTime;
        if (attendance.inLocation) attendance.punches[0].inLocation = attendance.inLocation;
        if (attendance.outLocation) attendance.punches[0].outLocation = attendance.outLocation;
      }
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