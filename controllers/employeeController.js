const Employee = require('../models/Employee');
const bcrypt = require('bcryptjs');

// Create Employee
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
    } = req.body;

    const existing = await Employee.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Employee email already exists' });

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

// Update Employee
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
    if (aadharNumber) employee.aadharNumber = aadharNumber;
    if (panNumber) employee.panNumber = panNumber;
    if (userUpi) employee.userUpi = userUpi;
    if (weeklyHoliday) employee.weeklyHoliday = weeklyHoliday;
    if (address) employee.address = address;
    if (accessPermissions) employee.accessPermissions = accessPermissions;
    if (adharImage) employee.adharImage = adharImage;
    if (panImage) employee.panImage = panImage;
    if (profileImage) employee.profileImage = profileImage;
    if (qrCode) employee.qrCode = qrCode;

    if (password) {
      const salt = await bcrypt.genSalt(10);
      employee.password = await bcrypt.hash(password, salt);
    }

 await employee.save();
    res.json({ message: 'Employee updated', employee });
  } catch (error) {
    console.error('Update employee error:', error);  // Log error to console
    res.status(500).json({ message: 'Server error', error: error.message || error });
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
