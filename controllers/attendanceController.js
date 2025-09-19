const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');

async function getCompanyIdFromUser (user) {
  if (user.role === 'company') {
    return user.userId; // userId is companyId
  } else {
    const employee = await Employee.findById(user.userId).select('company');
    if (!employee) throw new Error('Employee not found');
    return employee.company.toString();
  }
}

// // Create or update attendance record for an employee on a date
// exports.markAttendance = async (req, res) => {
//   try {
//     const company = await getCompanyIdFromUser (req.user);
//     const {
//       employee, // employee ID
//       date,
//       inTime,
//       inLocation,
//       inPhoto,
//       outTime,
//       outLocation,
//       outPhoto,
//       status,
//     } = req.body;

//     if (!employee || !date || !inTime) {
//       return res.status(400).json({ message: 'employee, date, and inTime are required' });
//     }

//     // Validate employee belongs to company
//     const emp = await Employee.findOne({ _id: employee, company });
//     if (!emp) {
//       return res.status(400).json({ message: 'Employee not found in your company' });
//     }

//     // Calculate workingTime if outTime is provided
//     let workingTime = null;
//     if (outTime) {
//       const inDate = new Date(inTime);
//       const outDate = new Date(outTime);
//       workingTime = Math.max(0, (outDate - inDate) / 1000 / 60); // minutes
//     }

//     // Upsert attendance record for employee and date
//     const attendance = await Attendance.findOneAndUpdate(
//       { company, employee, date: new Date(date).setHours(0,0,0,0) },
//       {
//         company,
//         employee,
//         date: new Date(date).setHours(0,0,0,0),
//         inTime,
//         inLocation,
//         inPhoto,
//         outTime,
//         outLocation,
//         outPhoto,
//         workingTime,
//         status: status || 'Present',
//       },
//       { upsert: true, new: true, setDefaultsOnInsert: true }
//     );

//     res.status(200).json({ message: 'Attendance marked successfully', attendance });
//   } catch (error) {
//     console.error('Mark attendance error:', error);
//     res.status(500).json({ message: 'Server error', error: error.message });
//   }
// };

// Mark attendance with image upload support
exports.markAttendanceWithImages = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser (req.user);

    const {
      employee,
      date,
      inTime,
      inLocation,
      outTime,
      outLocation,
      status,
    } = req.body;

    if (!employee || !date || !inTime) {
      return res.status(400).json({ message: 'employee, date, and inTime are required' });
    }

    // Validate employee belongs to company
    const emp = await Employee.findOne({ _id: employee, company });
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
    const company = await getCompanyIdFromUser (req.user);
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
    const company = await getCompanyIdFromUser (req.user);

    const filters = { company };

    if (req.query.employee) filters.employee = req.query.employee;

    if (req.query.startDate || req.query.endDate) {
      filters.date = {};
      if (req.query.startDate) filters.date.$gte = new Date(req.query.startDate).setHours(0,0,0,0);
      if (req.query.endDate) filters.date.$lte = new Date(req.query.endDate).setHours(23,59,59,999);
    }

    const records = await Attendance.find(filters)
      .populate('employee', 'firstName lastName')
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
    const company = await getCompanyIdFromUser (req.user);
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

// exports.updateAttendance = async (req, res) => {
//   try {
//     const company = await getCompanyIdFromUser (req.user);
//     const { id } = req.params;
//     const updateData = req.body;


//     // Find and update attendance record belonging to company
//     const attendance = await Attendance.findOneAndUpdate(
//       { _id: id, company },
//       updateData,
//       { new: true, runValidators: true }
//     );

//     if (!attendance) {
//       return res.status(404).json({ message: 'Attendance record not found or not authorized' });
//     }

//     res.json({ message: 'Attendance updated successfully', attendance });
//   } catch (error) {
//     console.error('Update attendance error:', error);
//     res.status(500).json({ message: 'Server error', error: error.message });
//   }
// };



// Delete attendance record by ID
exports.deleteAttendance = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser (req.user);
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