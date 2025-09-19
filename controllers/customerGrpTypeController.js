const CustomerGrpType = require('../models/CustomerGrpType');

exports.createGroupType = async (req, res) => {
  try {
    const { name, company } = req.body;

    const groupType = new CustomerGrpType({ name, company });
    await groupType.save();

    res.status(201).json({ message: 'Group Type created', groupType });
  } catch (error) {
    console.error('Create Group Type error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getGroupTypes = async (req, res) => {
  try {
    const { company } = req.query;
    const filter = {};

    if (company) filter.company = company;

    const groupTypes = await CustomerGrpType.find(filter).sort({ name: 1 });

    res.json({ groupTypes });
  } catch (error) {
    console.error('Get Group Types error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getGroupTypeById = async (req, res) => {
  try {
    const { id } = req.params;

    const groupType = await CustomerGrpType.findById(id);

    if (!groupType) {
      return res.status(404).json({ message: 'Group Type not found' });
    }

    res.json({ groupType });
  } catch (error) {
    console.error('Get Group Type by ID error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.updateGroupType = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const groupType = await CustomerGrpType.findByIdAndUpdate(id, updates, { new: true });

    if (!groupType) {
      return res.status(404).json({ message: 'Group Type not found' });
    }

    res.json({ message: 'Group Type updated', groupType });
  } catch (error) {
    console.error('Update Group Type error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.deleteGroupType = async (req, res) => {
  try {
    const { id } = req.params;

    const groupType = await CustomerGrpType.findByIdAndDelete(id);

    if (!groupType) {
      return res.status(404).json({ message: 'Group Type not found' });
    }

    res.json({ message: 'Group Type deleted' });
  } catch (error) {
    console.error('Delete Group Type error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
