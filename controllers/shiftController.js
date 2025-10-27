// controllers/shiftController.js
const Shift = require('../models/Shifts');

// Create a new shift
exports.createShift = async (req, res) => {
  try {
    const { name, startTime, endTime } = req.body;

    if (!name || !startTime || !endTime) {
      return res.status(400).json({ message: 'Name, startTime and endTime are required' });
    }
    
    console.log("req.user",req.user);
    
    const shift = new Shift({ name, startTime, endTime, company: req.user.companyId || req.user.userId 
});
    await shift.save();

    res.status(201).json({ message: 'Shift created successfully', shift });
  } catch (error) {
    console.error('Create shift error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all shifts
exports.getAllShifts = async (req, res) => {
  try {
    // UPDATED: Filter shifts by the user's company only
    const shifts = await Shift.find({ company: req.user.companyId || req.user.userId }).sort({ createdAt: -1 });
    res.json(shifts);
  } catch (error) {
    console.error('Get shifts error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get a single shift by ID
exports.getShiftById = async (req, res) => {
  try {
    const { shiftId } = req.params;
    const shift = await Shift.findById(shiftId);
    if (!shift) {
      return res.status(404).json({ message: 'Shift not found' });
    }
    res.json(shift);
  } catch (error) {
    console.error('Get shift error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update a shift by ID

exports.updateShift = async (req, res) => {
  try {
    const { shiftId } = req.params;
    const updates = req.body;
    // UPDATED: Ensure the shift belongs to the user's company
    const shift = await Shift.findOneAndUpdate(
      { _id: shiftId, company: req.user.companyId || req.user.userId }, 
      updates, 
      { new: true, runValidators: true }
    );
    if (!shift) {
      return res.status(404).json({ message: 'Shift not found or access denied' });
    }
    res.json({ message: 'Shift updated successfully', shift });
  } catch (error) {
    console.error('Update shift error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete a shift by ID
exports.deleteShift = async (req, res) => {
  try {
    const { shiftId } = req.params;
    const shift = await Shift.findByIdAndDelete(shiftId);
    if (!shift) {
      return res.status(404).json({ message: 'Shift not found' });
    }
    res.json({ message: 'Shift deleted successfully' });
  } catch (error) {
    console.error('Delete shift error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
