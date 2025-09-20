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
      department,
      role,
      designation,
      aadharNumber,
      panNumber,
      userUpi,
      weeklyHoliday,
      address,
      accessPermissions,
      qrCode
    } = req.body;

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
      department,
      role,
      designation,
      aadharNumber,
      panNumber,
      userUpi,
      weeklyHoliday,
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
    res.status(500).json({ message: 'Server error', error });
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
      department,
      role,
      designation,
      aadharNumber,
      panNumber,
      userUpi,
      weeklyHoliday,
      address,
      accessPermissions,
      qrCode
    } = req.body;

    if (teamMemberName) employee.teamMemberName = teamMemberName;
    if (mobileNumber) employee.mobileNumber = mobileNumber;
    if (emergencyMobileNumber) employee.emergencyMobileNumber = emergencyMobileNumber;
    if (email) employee.email = email;
    if (salary !== undefined) employee.salary = salary;
    if (dateOfJoining) employee.dateOfJoining = dateOfJoining;
    if (shift) employee.shift = shift;
    if (department) employee.department = department;
    if (role) employee.role = role;
    if (designation) employee.designation = designation;
    if (aadharNumber) employee.aadharNumber = aadharNumber;
    if (panNumber) employee.panNumber = panNumber;
    if (userUpi) employee.userUpi = userUpi;
    if (weeklyHoliday) employee.weeklyHoliday = weeklyHoliday;
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
      employee.password = await bcrypt.hash(password, salt);
    }

    await employee.save();
    res.json({ message: 'Employee updated', employee });
  } catch (error) {
    console.error('Update employee error:', error);
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
