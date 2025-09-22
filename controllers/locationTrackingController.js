const LocationTracking = require('../models/LocationTracking');
const Employee = require('../models/Employee');
const mongoose = require('mongoose');

/**
 * Create/Save a batch of location data for a route
 * Expects: Array of location points from localStorage
 */
exports.createLocationBatch = async (req, res) => {
  try {
    const { routeId, locations, taskId, notes } = req.body;
    const employeeId = req.user.userId;  // From auth middleware (employee's ID)
    const companyId = req.user.companyId;  // From auth middleware

    // Validation
    if (!routeId || !Array.isArray(locations) || locations.length === 0) {
      return res.status(400).json({ message: 'routeId and locations array are required' });
    }

    if (locations.length > 100) {  // Limit batch size to prevent abuse
      return res.status(400).json({ message: 'Batch too large (max 100 points)' });
    }

    // Validate employee exists and belongs to company
    const employee = await Employee.findOne({ _id: employeeId, company: companyId });
    if (!employee) {
      return res.status(403).json({ message: 'Employee not authorized for this company' });
    }

    // Validate each location point
    const validLocations = locations.map(point => {
      if (!point.latitude || !point.longitude || !point.timestamp) {
        throw new Error('Each location must have latitude, longitude, and timestamp');
      }
      return {
        latitude: point.latitude,
        longitude: point.longitude,
        timestamp: new Date(point.timestamp),
        speed: point.speed || undefined,
        accuracy: point.accuracy || undefined,
        batteryLevel: point.batteryLevel || undefined,
        taskId: point.taskId ? new mongoose.Types.ObjectId(point.taskId) : undefined
      };
    });

    // Create the batch document
    const batch = new LocationTracking({
      employee: employeeId,
      company: companyId,
      routeId,
      locations: validLocations,
      startTime: new Date(Math.min(...validLocations.map(loc => loc.timestamp))),
      endTime: new Date(),
      totalPoints: validLocations.length,
      taskId: taskId ? new mongoose.Types.ObjectId(taskId) : undefined,
      notes
    });

    await batch.save();

    // Optional: Update employee's last seen location or status
    // await Employee.findByIdAndUpdate(employeeId, { lastLocation: validLocations[validLocations.length - 1] });

    res.status(201).json({ 
      message: 'Location batch saved successfully', 
      batchId: batch._id,
      pointsSaved: validLocations.length 
    });
  } catch (error) {
    console.error('Create location batch error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Get location history for an employee/route (for admin/company dashboard)
 * Query params: employeeId, routeId, startDate, endDate
 */
exports.getLocationHistory = async (req, res) => {
  try {
    const { employeeId, routeId, startDate, endDate } = req.query;
    const companyId = req.user.companyId;  // Company admin viewing

    const filters = { company: companyId };
    if (employeeId) filters.employee = new mongoose.Types.ObjectId(employeeId);
    if (routeId) filters.routeId = routeId;
    if (startDate) filters.startTime = { $gte: new Date(startDate) };
    if (endDate) filters.endTime = { $lte: new Date(endDate) };

    const history = await LocationTracking.find(filters)
      .populate('employee', 'firstName lastName role')
      .populate('taskId', 'title')
      .sort({ startTime: -1 })
      .limit(50);  // Limit results

    res.json({ history });
  } catch (error) {
    console.error('Get location history error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Get real-time/last location for an employee (for quick checks)
 */
exports.getLastLocation = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const companyId = req.user.companyId;

    const latestBatch = await LocationTracking.findOne({
      employee: new mongoose.Types.ObjectId(employeeId),
      company: companyId
    })
    .sort({ endTime: -1 })
    .limit(1);

    if (!latestBatch) {
      return res.status(404).json({ message: 'No location data found' });
    }

    const lastPoint = latestBatch.locations[latestBatch.locations.length - 1];

    res.json({
      employeeId,
      lastLocation: {
        latitude: lastPoint.latitude,
        longitude: lastPoint.longitude,
        timestamp: lastPoint.timestamp,
        routeId: latestBatch.routeId
      }
    });
  } catch (error) {
    console.error('Get last location error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
