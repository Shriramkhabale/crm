const Designation = require('../models/Designation');
const Department = require('../models/Department');
const Employee = require('../models/Employee');

async function getCompanyIdFromUser (user) {
  if (user.role === 'company') {
    return user.userId;
  } else {
    const employee = await Employee.findById(user.userId).select('company');
    if (!employee) throw new Error('Employee not found');
    return employee.company.toString();
  }
}

exports.createDesignation = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser (req.user);
    const { name, description, department, permissions } = req.body;

    if (!name || !department) {
      return res.status(400).json({ message: 'Designation name and department are required' });
    }

    // Validate department belongs to company
    const dept = await Department.findOne({ _id: department, company });
    if (!dept) {
      return res.status(400).json({ message: 'Department not found in your company' });
    }

    // Create role
    const designation = new Designation({
      name,
      company,
      department,
    });

    await designation.save();

    res.status(201).json({ message: 'Designation created successfully', designation });
  } catch (error) {
    console.error('Create designation error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Designation with this name already exists in the department' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getDesignations = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser (req.user);
    const filters = { company };

    if (req.query.department) filters.department = req.query.department;

    const designations = await Designation.find(filters)
      .populate('department', 'name')
      .sort({ name: 1 });

    res.json({ designations });
  } catch (error) {
    console.error('Get designations error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getDesignationById = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser (req.user);
    const { id } = req.params;

    const role = await Designation.findOne({ _id: id, company })
      .populate('department', 'name');

    if (!role) {
      return res.status(404).json({ message: 'Designation not found' });
    }

    res.json({ role });
  } catch (error) {
    console.error('Get role by ID error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.updateDesignation = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser (req.user);
    const { id } = req.params;
    const updateData = req.body;

    if (updateData.department) {
      // Validate department belongs to company
      const dept = await Department.findOne({ _id: updateData.department, company });
      if (!dept) {
        return res.status(400).json({ message: 'Department not found in your company' });
      }
    }

    const role = await Designation.findOneAndUpdate(
      { _id: id, company },
      updateData,
      { new: true, runValidators: true }
    );

    if (!role) {
      return res.status(404).json({ message: 'Designation not found or not authorized' });
    }

    res.json({ message: 'Designation updated successfully', role });
  } catch (error) {
    console.error('Update role error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Designation with this name already exists in the department' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.deleteDesignation = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser (req.user);
    const { id } = req.params;

    const role = await Designation.findOneAndDelete({ _id: id, company });
    if (!role) {
      return res.status(404).json({ message: 'Designation not found or not authorized' });
    }

    res.json({ message: 'Designation deleted successfully' });
  } catch (error) {
    console.error('Delete role error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
