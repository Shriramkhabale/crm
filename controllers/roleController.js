const Role = require('../models/Role');
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

exports.createRole = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser (req.user);
    const { name, description, department, permissions } = req.body;

    if (!name || !department) {
      return res.status(400).json({ message: 'Role name and department are required' });
    }

    // Validate department belongs to company
    const dept = await Department.findOne({ _id: department, company });
    if (!dept) {
      return res.status(400).json({ message: 'Department not found in your company' });
    }

    // Create role
    const role = new Role({
      name,
      company,
      department,
    });

    await role.save();

    res.status(201).json({ message: 'Role created successfully', role });
  } catch (error) {
    console.error('Create role error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Role with this name already exists in the department' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getRoles = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser (req.user);
    const filters = { company };

    if (req.query.department) filters.department = req.query.department;

    const roles = await Role.find(filters)
      .populate('department', 'name')
      .sort({ name: 1 });

    res.json({ roles });
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getRoleById = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser (req.user);
    const { id } = req.params;

    const role = await Role.findOne({ _id: id, company })
      .populate('department', 'name');

    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    res.json({ role });
  } catch (error) {
    console.error('Get role by ID error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.updateRole = async (req, res) => {
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

    const role = await Role.findOneAndUpdate(
      { _id: id, company },
      updateData,
      { new: true, runValidators: true }
    );

    if (!role) {
      return res.status(404).json({ message: 'Role not found or not authorized' });
    }

    res.json({ message: 'Role updated successfully', role });
  } catch (error) {
    console.error('Update role error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Role with this name already exists in the department' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.deleteRole = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser (req.user);
    const { id } = req.params;

    const role = await Role.findOneAndDelete({ _id: id, company });
    if (!role) {
      return res.status(404).json({ message: 'Role not found or not authorized' });
    }

    res.json({ message: 'Role deleted successfully' });
  } catch (error) {
    console.error('Delete role error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
