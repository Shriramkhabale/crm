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
    const companyId = req.user.companyId  || req.user.userId;


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

      // Upload updated locations to Cloudinary as raw JSON
      const cloudinaryUrl = await uploadLocationsToCloudinary(
        batch.locations,
        employeeId,
        companyId,
        taskId
      );
      if (cloudinaryUrl) batch.cloudinaryUrl = cloudinaryUrl;
      
      await batch.save();
      
      res.status(200).json({
        message: 'Location batch appended successfully',
        batchId: batch._id,
        pointsAppended: newPoints.length,
        totalPoints: batch.totalPoints,
        cloudinaryUrl: batch.cloudinaryUrl || null
      });
    } else {
      // CREATE MODE: New document
      console.log(`Creating new tracking document for task/employee`);
      
      if (!taskId) {
        console.warn('No taskId provided; creating general employee tracking');
      }
      
      const batchStartTime = new Date(Math.min(...validLocations.map(loc => loc.timestamp)));

      // Upload locations to Cloudinary as raw JSON
      const cloudinaryUrl = await uploadLocationsToCloudinary(
        validLocations,
        employeeId,
        companyId,
        taskId
      );
      
      batch = new LocationTracking({
        employee: employeeId,
        company: companyId,
        taskId: taskObjectId,
        locations: validLocations,
        startTime: batchStartTime,
        endTime: new Date(),
        totalPoints: validLocations.length,
        notes,
        cloudinaryUrl: cloudinaryUrl || undefined
      });

      await batch.save();
      
      res.status(201).json({
        message: 'Location batch created successfully',
        batchId: batch._id,
        pointsSaved: validLocations.length,
        totalPoints: batch.totalPoints,
        cloudinaryUrl: cloudinaryUrl || null
      });
    }

  } catch (error) {
    console.error('Create/Append location batch error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Helper: Upload location array to Cloudinary as a raw JSON file
 * Uses upload_preset "ios_location_upload" and resource_type "raw"
 * Returns the secure_url string, or null on failure
 */
const uploadLocationsToCloudinary = async (locations, employeeId, companyId, taskId) => {
  try {
    const cloudinary = require('../config/cloudinaryConfig');

    // Build the JSON payload
    const payload = {
      employeeId: employeeId.toString(),
      companyId: companyId.toString(),
      taskId: taskId ? taskId.toString() : null,
      uploadedAt: new Date().toISOString(),
      locations: locations.map(loc => ({
        latitude: loc.latitude,
        longitude: loc.longitude,
        timestamp: loc.timestamp instanceof Date ? loc.timestamp.toISOString() : loc.timestamp,
        speed: loc.speed || null,
        accuracy: loc.accuracy || null,
        batteryLevel: loc.batteryLevel || null
      }))
    };

    const jsonString = JSON.stringify(payload);

    // Use a unique public_id per employee+company+task so it overwrites on append
    const publicId = `location_tracking/${companyId}/${employeeId}${taskId ? '_' + taskId : ''}`;

    // Upload as raw buffer via base64 data URI
    const dataUri = `data:application/json;base64,${Buffer.from(jsonString).toString('base64')}`;

    const result = await cloudinary.uploader.upload(dataUri, {
      resource_type: 'raw',
      upload_preset: 'ios_location_upload',
      public_id: publicId,
      overwrite: true,
      invalidate: true
    });

    console.log('✅ Location data uploaded to Cloudinary:', result.secure_url);
    return result.secure_url;

  } catch (err) {
    // Non-fatal: log error but don't block the main response
    console.error('⚠️  Cloudinary upload failed (location saved to MongoDB only):', err.message);
    return null;
  }
};

/**
 * Get location history - Filter by taskId or employeeId
 */
const getLocationHistory = async (req, res) => {
  console.log("req.user",req.user);
  
  try {
    const { taskId, employeeId, startDate, endDate } = req.query;
    const companyId = req.user.companyId ||  req.user.userId;

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
    const companyId = req.user.companyId || req.user.userId;

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
      cloudinaryUrl: latestBatch.cloudinaryUrl || null,  // Android can fetch full JSON from here
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

/**
 * Get Cloudinary URL for a specific employee's location batch
 * Android uses this to directly download the full location JSON from Cloudinary
 * GET /api/location/cloudinary-url/:employeeId
 */
const getCloudinaryUrl = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { taskId } = req.query;
    const companyId = req.user.companyId || req.user.userId;

    const filter = {
      employee: new mongoose.Types.ObjectId(employeeId),
      company: companyId
    };
    if (taskId) filter.taskId = new mongoose.Types.ObjectId(taskId);

    const batch = await LocationTracking.findOne(filter).sort({ endTime: -1 });

    if (!batch) {
      return res.status(404).json({ message: 'No location batch found for this employee' });
    }

    if (!batch.cloudinaryUrl) {
      return res.status(404).json({ message: 'No Cloudinary URL found — data may only be in MongoDB' });
    }

    res.json({
      employeeId,
      taskId: batch.taskId || null,
      cloudinaryUrl: batch.cloudinaryUrl,
      totalPoints: batch.totalPoints,
      lastUpdated: batch.updatedAt || batch.endTime
    });
  } catch (error) {
    console.error('Get Cloudinary URL error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// EXPLICIT EXPORTS - This ensures the object is complete and reliable
module.exports = {
  createLocationBatch,
  getLocationHistory,
  getLastLocation,
  getCloudinaryUrl
};
