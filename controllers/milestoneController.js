//controllers/MilestoneController.js
const Milestone = require('../models/Milestone');

exports.createMilestone = async (req, res) => {
  try {
    const { title, projectName, dueDate, status, company } = req.body;

    const milestone = new Milestone({
      title,
      projectName,
      dueDate,
      status,
      company
    });

    await milestone.save();

    res.status(201).json({ message: 'Milestone created', milestone });
  } catch (error) {
    console.error('Create milestone error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getMilestones = async (req, res) => {
  try {
    const { company, status } = req.query;
    const filter = {};

    if (company) filter.company = company;
    if (status) filter.status = status;

    const milestones = await Milestone.find(filter).sort({ dueDate: 1 });

    res.json({ milestones });
  } catch (error) {
    console.error('Get milestones error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getMilestoneById = async (req, res) => {
  try {
    const { id } = req.params;

    const milestone = await Milestone.findById(id);

    if (!milestone) {
      return res.status(404).json({ message: 'Milestone not found' });
    }

    res.json({ milestone });
  } catch (error) {
    console.error('Get milestone by ID error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.updateMilestone = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const milestone = await Milestone.findByIdAndUpdate(id, updates, { new: true });

    if (!milestone) {
      return res.status(404).json({ message: 'Milestone not found' });
    }

    res.json({ message: 'Milestone updated', milestone });
  } catch (error) {
    console.error('Update milestone error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.deleteMilestone = async (req, res) => {
  try {
    const { id } = req.params;

    const milestone = await Milestone.findByIdAndDelete(id);

    if (!milestone) {
      return res.status(404).json({ message: 'Milestone not found' });
    }

    res.json({ message: 'Milestone deleted' });
  } catch (error) {
    console.error('Delete milestone error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
