const Branch = require('../models/Branch');

// Create a new branch
exports.createBranch = async (req, res) => {
  try {
    const { company, name, password, address, phone, email } = req.body;

    if (!company || !name) {
      return res.status(400).json({ message: 'Company and branch name are required' });
    }

    const branch = new Branch({ company, name, password, address, phone, email });
    await branch.save();

    res.status(201).json({ message: 'Branch created successfully', branch });
  } catch (error) {
    console.error('Create branch error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all branches for a company
exports.getBranchesByCompany = async (req, res) => {
  try {
    const { companyId } = req.params;

    const branches = await Branch.find({ company: companyId }).sort({ createdAt: -1 });

    res.json({ branches });
  } catch (error) {
    console.error('Get branches error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get branch by ID
exports.getBranchById = async (req, res) => {
  try {
    const { id } = req.params;

    const branch = await Branch.findById(id);
    if (!branch) {
      return res.status(404).json({ message: 'Branch not found' });
    }

    res.json({ branch });
  } catch (error) {
    console.error('Get branch by ID error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update branch by ID
exports.updateBranch = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const branch = await Branch.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
    if (!branch) {
      return res.status(404).json({ message: 'Branch not found' });
    }

    res.json({ message: 'Branch updated successfully', branch });
  } catch (error) {
    console.error('Update branch error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete branch by ID
exports.deleteBranch = async (req, res) => {
  try {
    const { id } = req.params;

    const branch = await Branch.findByIdAndDelete(id);
    if (!branch) {
      return res.status(404).json({ message: 'Branch not found' });
    }

    res.json({ message: 'Branch deleted successfully' });
  } catch (error) {
    console.error('Delete branch error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};