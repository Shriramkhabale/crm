const Holiday = require('../models/HolidayCreation');

// CREATE NEW HOLIDAY
exports.createHoliday = async (req, res) => {
  try {
    const { holidayName, startDate, endDate, reason } = req.body;
    const { companyId } = req.params;

    if (!holidayName || !startDate || !endDate || !reason) {
      return res.status(400).json({ message: "All holiday fields are required" });
    }

    if (!companyId) {
      return res.status(400).json({ message: "Company ID is required" });
    }

    const holiday = await Holiday.create({
      holidayName,
      startDate,
      endDate,
      reason,
      companyId
    });

    res.status(201).json(holiday);
  } catch (error) {
    console.log("❌ CREATE HOLIDAY ERROR:", error);
    res.status(500).json({ error: error.message });
  }
};

// GET ALL HOLIDAYS
exports.getHolidays = async (req, res) => {
  try {
    const { companyId } = req.params;
    const filter = companyId ? { companyId } : {};
    const holidays = await Holiday.find(filter).sort({ startDate: 1 });
    res.status(200).json(holidays);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE HOLIDAY
exports.updateHoliday = async (req, res) => {
  try {
    const holiday = await Holiday.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!holiday) {
      return res.status(404).json({ message: "Holiday not found" });
    }

    res.status(200).json(holiday);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE HOLIDAY
exports.deleteHoliday = async (req, res) => {
  try {
    const holiday = await Holiday.findByIdAndDelete(req.params.id);

    if (!holiday) {
      return res.status(404).json({ message: "Holiday not found" });
    }

    res.status(200).json({ message: "Holiday deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
