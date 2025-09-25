// controllers/employeeController.js
// controllers/employeeController.js
const Employee = require('../models/Employee');
const bcrypt = require('bcryptjs');

exports.createEmployee = async (req, res) => {
  try {
    const {
      company,
      teamMemberName,
      mobileNumber,
      emergencyMobileNumber,
      email,
      password,
      salary,
      dateOfJoining,
      shift,
      departments,  // <-- Changed: Expect 'departments' (plural) from frontend
      role,
      designation,
      aadharNumber,
      panNumber,
      userUpi,
      paidLeaves,
      weeklyHoliday,
      address,
      accessPermissions,
      qrCode
    } = req.body;

    // Validate departments array
    if (!departments || !Array.isArray(departments) || departments.length === 0) {
      return res.status(400).json({ message: 'At least one department is required' });
    }

    // Ensure departments are unique and non-empty strings
    const validDepartments = [...new Set(departments.filter(id => id && id.trim() !== ''))];
    if (validDepartments.length === 0) {
      return res.status(400).json({ message: 'Invalid departments provided' });
    }

    console.log('Creating employee with departments:', validDepartments); // Debug log

    const existing = await Employee.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Employee email already exists' });

    // Extract uploaded file URLs
    const adharImage = req.files?.adharImage ? req.files.adharImage[0].path : undefined;
    const panImage = req.files?.panImage ? req.files.panImage[0].path : undefined;
    const profileImage = req.files?.profileImage ? req.files.profileImage[0].path : undefined;

    const employee = new Employee({
      company,
      teamMemberName,
      mobileNumber,
      emergencyMobileNumber,
      email,
      password,
      salary,
      dateOfJoining,
      shift,
      department: validDepartments,  // <-- Fixed: Assign 'departments' to model field 'department' (as array)
      role,
      designation,
      aadharNumber,
      panNumber,
      userUpi,
      weeklyHoliday,
      paidLeaves,
      address,
      accessPermissions,
      adharImage,
      panImage,
      profileImage,
      qrCode
    });

    await employee.save();
    res.status(201).json({ message: 'Employee created', employee });
  } catch (error) {
    console.error('Create employee error:', error); // Enhanced logging
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await Employee.findById(id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    const {
      teamMemberName,
      mobileNumber,
      emergencyMobileNumber,
      email,
      password,
      salary,
      dateOfJoining,
      shift,
      departments,  // <-- Changed: Expect 'departments' (plural) from frontend
      role,
      designation,
      aadharNumber,
      panNumber,
      userUpi,
      weeklyHoliday,
      paidLeaves,
      address,
      accessPermissions,
      qrCode
    } = req.body;

    // Handle departments update (validate if provided)
    if (departments) {
      if (!Array.isArray(departments) || departments.length === 0) {
        return res.status(400).json({ message: 'Invalid departments provided' });
      }
      const validDepartments = [...new Set(departments.filter(id => id && id.trim() !== ''))];
      if (validDepartments.length === 0) {
        return res.status(400).json({ message: 'At least one department is required' });
      }
      employee.department = validDepartments;  // <-- Fixed: Assign to model field 'department' (as array)
      console.log('Updating employee departments:', validDepartments); // Debug log
    }

    if (teamMemberName) employee.teamMemberName = teamMemberName;
    if (mobileNumber) employee.mobileNumber = mobileNumber;
    if (emergencyMobileNumber) employee.emergencyMobileNumber = emergencyMobileNumber;
    if (email) employee.email = email;
    if (salary !== undefined) employee.salary = salary;
    if (dateOfJoining) employee.dateOfJoining = dateOfJoining;
    if (shift) employee.shift = shift;
    if (role) employee.role = role;
    if (designation) employee.designation = designation;
    if (aadharNumber) employee.aadharNumber = aadharNumber;
    if (panNumber) employee.panNumber = panNumber;
    if (userUpi) employee.userUpi = userUpi;
    if (weeklyHoliday) employee.weeklyHoliday = weeklyHoliday;
    if (paidLeaves) employee.paidLeaves = paidLeaves;
    if (address) employee.address = address;
    if (accessPermissions) employee.accessPermissions = accessPermissions;
    if (qrCode) employee.qrCode = qrCode;

    // Update images if uploaded
    if (req.files?.adharImage) {
      employee.adharImage = req.files.adharImage[0].path;
    }

    if (req.files?.panImage) {
      employee.panImage = req.files.panImage[0].path;
    }
    
    if (req.files?.profileImage) {
      employee.profileImage = req.files.profileImage[0].path;
    }

    if (password) {
      const salt = await bcrypt.genSalt(10);
      employee.password = await bcrypt.hash(password, (await bcrypt.genSalt(10)), salt);
    }

    await employee.save();
    res.json({ message: 'Employee updated', employee });
  } catch (error) {
    console.error('Update employee error:', error); // Enhanced logging
    res.status(500).json({ message: 'Server error', error: error.message || error });
  }
};


exports.getAllEmployees = async (req, res) => {
  try {
    const employees = await Employee.find();
    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Get employee by ID
exports.getEmployeeById = async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await Employee.findById(id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    res.json(employee);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};


// Get employees by company
exports.getEmployeesByCompany = async (req, res) => {
  try {
    const { companyId } = req.params;
    const employees = await Employee.find({ company: companyId });
    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};


// Delete Employee
exports.deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await Employee.findByIdAndDelete(id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    res.json({ message: 'Employee deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};
