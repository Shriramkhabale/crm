const Holiday = require('../models/Holiday');

// Create holiday
exports.createHoliday = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { name, date } = req.body;

    // Optional: check if holiday on same date already exists for company
    const existing = await Holiday.findOne({ company: companyId, date });
    if (existing) return res.status(400).json({ message: 'Holiday already exists on this date' });

    const holiday = new Holiday({ company: companyId, name, date});
    await holiday.save();

    res.status(201).json({ message: 'Holiday created', holiday });
  } catch (error) {
    console.error('Error creating holiday:', error);
    res.status(500).json({ message: 'Server error', error: error.message || error });
  }
};

// Get all holidays for a company
exports.getHolidaysByCompany = async (req, res) => {
  try {
    const { companyId } = req.params;
    const holidays = await Holiday.find({ company: companyId }).sort({ date: 1 });
    res.json(holidays);
  } catch (error) {
    console.error('Error fetching holidays:', error);
    res.status(500).json({ message: 'Server error', error: error.message || error });
  }
};

// Update holiday
exports.updateHoliday = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const holiday = await Holiday.findByIdAndUpdate(id, updates, { new: true });
    if (!holiday) return res.status(404).json({ message: 'Holiday not found' });

    res.json({ message: 'Holiday updated', holiday });
  } catch (error) {
    console.error('Error updating holiday:', error);
    res.status(500).json({ message: 'Server error', error: error.message || error });
  }
};

// Delete holiday
exports.deleteHoliday = async (req, res) => {
  try {
    const { id } = req.params;
    const holiday = await Holiday.findByIdAndDelete(id);
    if (!holiday) return res.status(404).json({ message: 'Holiday not found' });

    res.json({ message: 'Holiday deleted' });
  } catch (error) {
    console.error('Error deleting holiday:', error);
    res.status(500).json({ message: 'Server error', error: error.message || error });
  }
};