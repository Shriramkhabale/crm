const Department = require('../models/Department');

// Create department for a company
exports.createDepartment = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { name } = req.body;

    const existing = await Department.findOne({ company: companyId, name });
    if (existing) return res.status(400).json({ message: 'Department already exists for this company' });

    const department = new Department({ company: companyId, name });
    await department.save();

    res.status(201).json({ message: 'Department created', department });
  } catch (error) {
    console.error('Error creating department:', error);
    res.status(500).json({ message: 'Server error', error: error.message || error });
  }
};

// Get all departments for a company
exports.getDepartmentsByCompany = async (req, res) => {
  try {
    const { companyId } = req.params;
    const departments = await Department.find({ company: companyId });
    res.json(departments);
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ message: 'Server error', error: error.message || error });
  }
};

// Get one department by ID
exports.getDepartmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const department = await Department.findById(id);
    if (!department) return res.status(404).json({ message: 'Department not found' });
    res.json(department);
  } catch (error) {
    console.error('Error fetching department:', error);
    res.status(500).json({ message: 'Server error', error: error.message || error });
  }
};

// Update department by ID
exports.updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const department = await Department.findById(id);
    if (!department) return res.status(404).json({ message: 'Department not found' });

    if (name) department.name = name;

    await department.save();
    res.json({ message: 'Department updated', department });
  } catch (error) {
    console.error('Error updating department:', error);
    res.status(500).json({ message: 'Server error', error: error.message || error });
  }
};

// Delete department by ID
exports.deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const department = await Department.findByIdAndDelete(id);
    if (!department) return res.status(404).json({ message: 'Department not found' });
    res.json({ message: 'Department deleted' });
  } catch (error) {
    console.error('Error deleting department:', error);
    res.status(500).json({ message: 'Server error', error: error.message || error });
  }
};
