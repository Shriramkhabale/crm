const TrackingPoint = require('../models/TrackingPoint');
const TrackingLog = require('../models/TrackingLog');

// POST /api/tracking/location
exports.saveLocation = async (req, res) => {
  try {
    const { employeeId, companyId, date, latitude, longitude, accuracy, speed, timestamp } = req.body;

    if (!employeeId || !companyId || !date || latitude === undefined || longitude === undefined || !timestamp) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const newPoint = new TrackingPoint({
      employeeId,
      companyId,
      date,
      latitude,
      longitude,
      accuracy,
      speed,
      timestamp
    });

    await newPoint.save();
    res.status(201).json({ message: 'Location saved successfully', data: newPoint });
  } catch (error) {
    console.error('Error saving location:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// GET /api/tracking/route/:employeeId/:date
exports.getRoute = async (req, res) => {
  try {
    const { employeeId, date } = req.params;

    const points = await TrackingPoint.find({ employeeId, date }).sort({ timestamp: 1 });

    res.status(200).json(points);
  } catch (error) {
    console.error('Error fetching route:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// POST /api/tracking/log
exports.saveLog = async (req, res) => {
  try {
    const { employeeId, companyId, date, event, timestamp } = req.body;

    if (!employeeId || !companyId || !date || !event || !timestamp) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Find the most recent log for this employee on this date
    const latestLog = await TrackingLog.findOne({ employeeId, date }).sort({ timestamp: -1 });

    // Prevent consecutive identical events (e.g., double punch-in or double punch-out)
    if (latestLog && latestLog.event === event) {
      return res.status(200).json({ message: `${event} already recorded as the latest action`, data: latestLog });
    }

    const newLog = new TrackingLog({
      employeeId,
      companyId,
      date,
      event,
      timestamp
    });

    await newLog.save();
    res.status(201).json({ message: 'Log saved successfully', data: newLog });
  } catch (error) {
    console.error('Error saving tracking log:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
