//controllers/locationTrackingController.js

const LocationTracking = require('../models/LocationTracking');
const Employee = require('../models/Employee');
const mongoose = require('mongoose');

/**
 * Create/Save a batch of location data - Appends to existing task document if found
 * Identification: taskId + employeeId + companyId
 */
const createLocationBatch = async (req, res) => {
console.log("req.user",req.user);
console.log("--------------------------------------");

  try {
    const { locations, taskId, notes } = req.body;  // No routeId
    const employeeId = req.user.userId;
    const companyId = req.user.companyId;


    // Validation
    if (!Array.isArray(locations) || locations.length === 0) {
      return res.status(400).json({ message: 'locations array is required' });
    }

    if (locations.length > 100) {
      return res.status(400).json({ message: 'Batch too large (max 100 points)' });
    }

    // Validate employee
    const employee = await Employee.findOne({ _id: employeeId, company: companyId });
    if (!employee) {
      return res.status(403).json({ message: 'Employee not authorized for this company' });
    }

    // Validate and prepare locations
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

    // Sort and deduplicate by timestamp
    validLocations.sort((a, b) => a.timestamp - b.timestamp);
    for (let i = 1; i < validLocations.length; i++) {
      if (Math.abs(validLocations[i].timestamp - validLocations[i - 1].timestamp) < 60000) {
        console.warn('Duplicate timestamp; skipping point');
        validLocations.splice(i, 1);
        i--;
      }
    }

    // Prepare taskId ObjectId (if provided)
    let taskObjectId = taskId ? new mongoose.Types.ObjectId(taskId) : null;

    // Find existing document by taskId + employee + company
    const filter = { 
      employee: employeeId, 
      company: companyId 
    };
    if (taskId) filter.taskId = taskObjectId;  // Include taskId if provided

    let batch = await LocationTracking.findOne(filter);

    if (batch) {
      // APPEND MODE: Update existing (task or general employee tracking)
      console.log(`Appending ${validLocations.length} points to existing task/employee tracking`);

      // Filter new points (timestamp > last existing)
      const lastExistingTime = batch.locations.length > 0 
        ? batch.locations[batch.locations.length - 1].timestamp 
        : new Date(0);
      
      const newPoints = validLocations.filter(loc => loc.timestamp > lastExistingTime);
      
      if (newPoints.length === 0) {
        return res.status(400).json({ message: 'No new points to append' });
      }
      
      batch.locations.push(...newPoints);
      batch.endTime = new Date();
      batch.totalPoints = batch.locations.length;
      if (taskId) batch.taskId = taskObjectId;  // Ensure taskId is set
      if (notes) batch.notes = notes;  // Update notes
      batch.status = notes && notes.includes('completed') ? 'completed' : batch.status;  // Auto-update status
      batch.updatedAt = new Date();
      
      await batch.save();
      
      res.status(200).json({
        message: 'Location batch appended successfully',
        batchId: batch._id,
        pointsAppended: newPoints.length,
        totalPoints: batch.totalPoints
      });
    } else {
      // CREATE MODE: New document
      console.log(`Creating new tracking document for task/employee`);
      
      if (!taskId) {
        console.warn('No taskId provided; creating general employee tracking');
      }
      
      const batchStartTime = new Date(Math.min(...validLocations.map(loc => loc.timestamp)));
      
      batch = new LocationTracking({
        employee: employeeId,
        company: companyId,
        taskId: taskObjectId,
        locations: validLocations,
        startTime: batchStartTime,
        endTime: new Date(),
        totalPoints: validLocations.length,
        notes
      });

      await batch.save();
      
      res.status(201).json({
        message: 'Location batch created successfully',
        batchId: batch._id,
        pointsSaved: validLocations.length,
        totalPoints: batch.totalPoints
      });
    }

  } catch (error) {
    console.error('Create/Append location batch error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Get location history - Filter by taskId or employeeId
 */
const getLocationHistory = async (req, res) => {
  try {
    const { taskId, employeeId, startDate, endDate } = req.query;
    const companyId = req.user.companyId;

    const filters = { company: companyId };
    if (taskId) filters.taskId = new mongoose.Types.ObjectId(taskId);
    if (employeeId) filters.employee = new mongoose.Types.ObjectId(employeeId);
    if (startDate) filters.startTime = { $gte: new Date(startDate) };
    if (endDate) filters.endTime = { $lte: new Date(endDate) };

    const history = await LocationTracking.find(filters)
      .populate('employee', 'firstName lastName role')
      .populate('taskId', 'title status')  // Populate task details
      .sort({ startTime: -1 })
      .limit(50);

    res.json({ history });  // Each doc has all appended locations for the task/employee
  } catch (error) {
    console.error('Get location history error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Get last location for employee (across all tasks)
 */
const getLastLocation = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const companyId = req.user.companyId;

    const latestBatch = await LocationTracking.findOne({
      employee: new mongoose.Types.ObjectId(employeeId),
      company: companyId
    })
    .sort({ endTime: -1 })
    .limit(1);

    if (!latestBatch || latestBatch.locations.length === 0) {
      return res.status(404).json({ message: 'No location data found' });
    }

    const lastPoint = latestBatch.locations[latestBatch.locations.length - 1];

    res.json({
      employeeId,
      taskId: latestBatch.taskId,  // Include associated task
      lastLocation: {
        latitude: lastPoint.latitude,
        longitude: lastPoint.longitude,
        timestamp: lastPoint.timestamp,
        totalPointsInTask: latestBatch.totalPoints
      }
    });
  } catch (error) {
    console.error('Get last location error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};


// EXPLICIT EXPORTS - This ensures the object is complete and reliable
module.exports = {
  createLocationBatch,
  getLocationHistory,
  getLastLocation
};


