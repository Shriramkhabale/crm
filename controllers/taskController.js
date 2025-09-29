// controller/taskController.js

const Task = require('../models/Task');
const Employee = require('../models/Employee');
const TaskStatusUpdate = require('../models/TaskStatusUpdate');
const mongoose = require('mongoose');

async function getCompanyIdFromUser (user) {
  if (user.role === 'company') {
    return user.userId; 
  } else{
    const employee = await Employee.findById(user.userId).select('company');
    if (!employee) throw new Error('Employee not found');
    return employee.company.toString();
  } 
}
const validWeekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// Helper: Generate instances up to LOOKAHEAD_DAYS ahead
const LOOKAHEAD_DAYS = 3;  // NEW: Configurable - generate 3 days in advance


async function generateRecurringInstances(parentTaskData, companyId) {
  if (!parentTaskData.repeat || !parentTaskData.recurrenceActive || !parentTaskData.nextFinishDateTime) {
    console.log('Skipping generation: repeat disabled or no end date');
    return [];  // Skip if disabled or no end date
  }
  
  const instances = [];
  let currentDate = new Date();  // Start from TODAY
  currentDate.setHours(0, 0, 0, 0);  // Normalize to start of day
  const endDateTime = new Date(parentTaskData.nextFinishDateTime);
  const lookaheadEnd = new Date(currentDate);
  lookaheadEnd.setDate(lookaheadEnd.getDate() + LOOKAHEAD_DAYS);
  if (lookaheadEnd > endDateTime) lookaheadEnd = endDateTime;  // Don't exceed series end
  
  const parentId = parentTaskData._id;
  const companyObjId = new mongoose.Types.ObjectId(companyId);
  
  // CORRECTED: Helper to create instance with duplicate check and validation
  const createInstance = async (instanceDate) => {
    try {
      // CORRECTED: Ensure future start (not just date)
      const now = new Date();
      now.setSeconds(0, 0);  // Normalize now
      if (instanceDate < now) {
        console.log(`Skipping past date: ${instanceDate.toISOString()}`);
        return null;
      }
      
      const startDt = new Date(instanceDate);
      startDt.setHours(
        parentTaskData.startDateTime.getHours(),
        parentTaskData.startDateTime.getMinutes(),
        0, 0  // Reset seconds/millis
      );
      const endDt = new Date(instanceDate);
      endDt.setHours(
        parentTaskData.endDateTime.getHours(),
        parentTaskData.endDateTime.getMinutes(),
        59, 999  // End of day
      );
      
      // CORRECTED: For daily tasks, enforce same day (start and end on same date)
      if (parentTaskData.repeatFrequency === 'daily') {
        endDt.setDate(startDt.getDate());  // Same day
        endDt.setMonth(startDt.getMonth());
        endDt.setFullYear(startDt.getFullYear());
      }
      
      // Skip if beyond series end or lookahead
      if (endDt > endDateTime || startDt > lookaheadEnd) {
        console.log(`Skipping beyond limits: ${startDt.toISOString()} to ${endDt.toISOString()}`);
        return null;
      }
      
      // CORRECTED: Check for existing instance to prevent duplicates
      const existing = await Task.findOne({
        parentTask: parentId,
        startDateTime: startDt,
        company: companyObjId
      });
      if (existing) {
        console.log(`Duplicate instance skipped: ${startDt.toISOString()}`);
        return existing;  // Return existing instead of creating new
      }
      
      // CORRECTED: For monthly, validate date doesn't roll over (e.g., Feb 31 -> Mar 3)
      if (parentTaskData.repeatFrequency === 'monthly' && instanceDate.getDate() !== parseInt(parentTaskData.repeatDatesOfMonth[0])) {  // Assuming first dayNum for check
        console.log(`Invalid monthly date (rolled over): ${instanceDate.toISOString()}`);
        return null;
      }
      
      const instance = new Task({
        title: parentTaskData.title,
        description: parentTaskData.description,
        department: parentTaskData.department,
        assignedTo: parentTaskData.assignedTo,
        startDateTime: startDt,
        endDateTime: endDt,
        status: 'pending',  // Reset for new instance
        creditPoints: parentTaskData.creditPoints,
        priority: parentTaskData.priority,
        company: parentTaskData.company,
        createdBy: parentTaskData.createdBy,
        images: parentTaskData.images || [],
        audios: parentTaskData.audios || [],
        files: parentTaskData.files || [],
        parentTask: parentId,
        isRecurringInstance: true,  // Flag as child
        recurrenceActive: parentTaskData.recurrenceActive  // Inherit
      });
      
      await instance.save();
      
      // OPTIONAL: Populate immediately (uncomment if needed for immediate use)
      // await instance.populate('assignedTo', 'firstName lastName role');
      // await instance.populate('createdBy', 'firstName lastName role');
      
      console.log(`Created instance: ${startDt.toISOString()} to ${endDt.toISOString()}`);
      return instance;
    } catch (error) {
      console.error(`Error creating instance for ${instanceDate.toISOString()}:`, error);
      return null;  // Skip on error
    }
  };
  
  let iterations = 0;
  const maxIterations = 100;  // Guard against infinite loops
  
  while (currentDate <= lookaheadEnd && iterations < maxIterations) {
    iterations++;
    let instanceDate = new Date(currentDate);
    instanceDate.setHours(0, 0, 0, 0);  // Normalize
    
    if (parentTaskData.repeatFrequency === 'daily') {
      const instance = await createInstance(instanceDate);
      if (instance) instances.push(instance);
      currentDate.setDate(currentDate.getDate() + 1);
      
    } else if (parentTaskData.repeatFrequency === 'weekly') {
      const currentDayName = instanceDate.toLocaleDateString('en-US', { weekday: 'long' });
      if (parentTaskData.repeatDaysOfWeek.includes(currentDayName)) {
        const instance = await createInstance(instanceDate);
        if (instance) instances.push(instance);
      }
      currentDate.setDate(currentDate.getDate() + 1);
      
    } else if (parentTaskData.repeatFrequency === 'monthly') {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      for (const dayNum of parentTaskData.repeatDatesOfMonth) {
        // CORRECTED: Create date and validate it stays in the month
        const testDate = new Date(year, month, dayNum);
        if (isNaN(testDate.getTime()) || testDate.getMonth() !== month || testDate > lookaheadEnd) {
          console.log(`Skipping invalid monthly date: ${year}-${month + 1}-${dayNum}`);
          continue;
        }
        const instance = await createInstance(testDate);
        if (instance) instances.push(instance);
      }
      // CORRECTED: Advance to next month properly
      currentDate.setMonth(currentDate.getMonth() + 1);
      currentDate.setDate(1);  // Start of next month
      if (currentDate.getDate() !== 1) currentDate.setDate(1);  // Ensure
    }
  }
  
  if (iterations >= maxIterations) {
    console.warn('Max iterations reached in generateRecurringInstances');
  }
  
  console.log(`Generated ${instances.length} recurring instances for task ${parentId}`);
  return instances;
}



// NEW: Endpoint to stop recurrence (PUT /task/tasks/:id/stop-recurrence)
exports.stopRecurrence = async (req, res) => {
  try {
    const { id } = req.params;
    const company = await getCompanyIdFromUser (req.user);
    const task = await Task.findOne({ _id: id, company, repeat: true, isRecurringInstance: { $ne: true } });
    if (!task) {
      return res.status(404).json({ message: 'Recurring parent task not found' });
    }
    task.recurrenceActive = false;
    await task.save();
    res.json({ message: 'Recurrence stopped. No new instances will be generated.', task });
  } catch (error) {
    console.error('Stop recurrence error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// NEW: Endpoint to resume recurrence (PUT /task/tasks/:id/resume-recurrence)
exports.resumeRecurrence = async (req, res) => {
  try {
    const { id } = req.params;
    const company = await getCompanyIdFromUser (req.user);
    const task = await Task.findOne({ _id: id, company, repeat: true, isRecurringInstance: { $ne: true } });
    if (!task) {
      return res.status(404).json({ message: 'Recurring parent task not found' });
    }
    task.recurrenceActive = true;
    await task.save();
    // Optionally regenerate immediate future instances
    const instances = await generateRecurringInstances(task.toObject(), company);
    res.json({ message: 'Recurrence resumed. New instances generated.', task, newInstances: instances.length });
  } catch (error) {
    console.error('Resume recurrence error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};



exports.createTask = async (req, res) => {
  try {
    const {
      title, description, department, assignedTo, startDateTime, endDateTime, repeat, creditPoints,
      repeatFrequency, repeatDaysOfWeek, repeatDatesOfMonth, priority, nextFollowUpDateTime,
      nextFinishDateTime, createdBy, status, company: bodyCompany
    } = req.body;
    const company = req.user.companyId || bodyCompany || req.user.userId;
    
    // Basic validation (existing)
    if (!title || !department || !assignedTo || !startDateTime || !endDateTime) {
      return res.status(400).json({ message: 'Title, department, assignedTo, startDateTime, and endDateTime are required' });
    }
    const assignedToArray = Array.isArray(assignedTo) ? assignedTo : [assignedTo];
    const assignee = await Employee.find({ _id: { $in: assignedToArray }, company: company.toString() });
    if (assignee.length !== assignedToArray.length) {
      return res.status(400).json({ message: 'One or more assigned users not found in your company' });
    }
    
    // Repeat validation (enhanced for multi-select) - unchanged
    if (repeat) {
      if (!repeatFrequency || !['daily', 'weekly', 'monthly'].includes(repeatFrequency)) {
        return res.status(400).json({ message: 'repeatFrequency must be one of daily, weekly, or monthly when repeat is true' });
      }
      if (!nextFinishDateTime || new Date(nextFinishDateTime) <= new Date(startDateTime)) {
        return res.status(400).json({ message: 'nextFinishDateTime must be after startDateTime when repeat is true' });
      }
      if (repeatFrequency === 'weekly') {
        if (!Array.isArray(repeatDaysOfWeek) || repeatDaysOfWeek.length === 0) {
          return res.status(400).json({ message: 'repeatDaysOfWeek must be a non-empty array when repeatFrequency is weekly' });
        }
        for (const day of repeatDaysOfWeek) {
          if (!validWeekDays.includes(day)) {
            return res.status(400).json({ message: `Invalid day in repeatDaysOfWeek: ${day}` });
          }
        }
      }
      if (repeatFrequency === 'monthly') {
        if (!Array.isArray(repeatDatesOfMonth) || repeatDatesOfMonth.length === 0) {
          return res.status(400).json({ message: 'repeatDatesOfMonth must be a non-empty array when repeatFrequency is monthly' });
        }
        for (const date of repeatDatesOfMonth) {
          if (typeof date !== 'number' || date < 1 || date > 31) {
            return res.status(400).json({ message: `Invalid date in repeatDatesOfMonth: ${date}` });
          }
        }
      }
    } else {
      if (!nextFollowUpDateTime) {
        return res.status(400).json({ message: 'nextFollowUpDateTime is required when repeat is false' });
      }
    }
    
    // Files (existing)
    const images = req.files?.images ? req.files.images.map(f => f.path) : [];
    const audios = req.files?.audios ? req.files.audios.map(f => f.path) : [];
    const files = req.files?.files ? req.files.files.map(f => f.path) : [];

    const taskData = {
      title, description, department, assignedTo: assignedToArray,
      startDateTime: new Date(startDateTime), endDateTime: new Date(endDateTime),
      repeat, creditPoints, repeatFrequency: repeat ? repeatFrequency : undefined,
      repeatDaysOfWeek: repeat && repeatFrequency === 'weekly' ? repeatDaysOfWeek : undefined,
      repeatDatesOfMonth: repeat && repeatFrequency === 'monthly' ? repeatDatesOfMonth : undefined,
      priority: priority || 'medium',
      nextFollowUpDateTime: !repeat ? new Date(nextFollowUpDateTime) : undefined,
      nextFinishDateTime: repeat ? new Date(nextFinishDateTime) : undefined,
      company: new mongoose.Types.ObjectId(company), status, createdBy: new mongoose.Types.ObjectId(createdBy),
      images, audios, files,
      isRecurringInstance: false,  // Always false for new tasks (parent or one-time)
      recurrenceActive: repeat ? true : false  // Active only if recurring
    };
    
    const task = new Task(taskData);
    await task.save();
    
    // FIXED: No auto-generation of instances on create - save only parent/one-time task
    // (Instances can be generated later via endpoint/cron if needed)
    console.log(`Task created: ${repeat ? 'Recurring parent' : 'One-time task'} with ID ${task._id}, repeat: ${repeat}`);

    // Populate
    await task.populate('assignedTo', 'firstName lastName role');
    await task.populate('createdBy', 'firstName lastName role');
    
    res.status(201).json({ 
      message: 'Task created successfully', 
      task  // Return single task (no recurringInstances array)
    });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// Update getAllTasks (add recurring filter param, replace existing function)
exports.getAllTasks = async (req, res) => {
  try {
    console.log('🔍 getAllTasks - Query params:', req.query);  // Log params (e.g., recurring=all)

    const companyStr = await getCompanyIdFromUser (req.user);  // String from function
    if (!companyStr) {
      return res.status(400).json({ message: 'Company ID not found in user data' });
    }

    // FIXED: Cast company to ObjectId for exact match in aggregation
    const companyObjId = new mongoose.Types.ObjectId(companyStr);
    console.log('🔍 Resolved company (string):', companyStr, ' (ObjectId):', companyObjId);  // Log for debug

    // Base filters: Always include company as ObjectId
    let filters = { 
      company: companyObjId,  // FIXED: Cast to ObjectId
      isRecurringInstance: { $ne: true }  // Parents/non-recurring by default
    };

    // Apply other query filters (existing)
    if (req.query.assignedTo) filters.assignedTo = new mongoose.Types.ObjectId(req.query.assignedTo);
    if (req.query.createdBy) filters.createdBy = new mongoose.Types.ObjectId(req.query.createdBy);
    if (req.query.department) filters.department = new mongoose.Types.ObjectId(req.query.department);
    if (req.query.priority) filters.priority = req.query.priority;
    if (req.query.repeat !== undefined) filters.repeat = req.query.repeat === 'true';

    console.log('🔍 Initial filters:', JSON.stringify(filters, null, 2));  // Log filters

    // Recurring filter logic (with fixes)
    const recurringFilter = req.query.recurring;  // 'recurring', 'non-recurring', 'all'
    if (recurringFilter === 'recurring') {
      filters.repeat = true;
      filters.recurrenceActive = true;
    } else if (recurringFilter === 'non-recurring') {
      // FIXED: Use $or without conflicting isRecurringInstance
      filters.$or = [
        { repeat: { $ne: true } },  // One-time tasks
        { isRecurringInstance: true },  // Children (treat as non-recurring)
        { recurrenceActive: false }  // Stopped series
      ];
      delete filters.isRecurringInstance;  // FIXED: Remove to avoid conflict with $or
    } else if (recurringFilter === 'all') {
      // FIXED: Broader match - include all tasks (parents + children) for company
      filters = { company: companyObjId };  // Remove isRecurringInstance to include everything
    }

    console.log('🔍 Final filters after recurring:', JSON.stringify(filters, null, 2));  // Log

    // FIXED: Test count before aggregation (for debug - remove after testing)
    const testCount = await Task.countDocuments(filters);
    console.log('🔍 Tasks matching filters (count):', testCount);  // Should be 1+ for your task

    // Aggregation pipeline (unchanged, but now filters match)
    const aggregation = await Task.aggregate([
      { $match: filters },
      {
        $lookup: {
          from: 'tasks',  // Self-join for children
          let: { parentId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$parentTask', '$$parentId'] } } },
            { $lookup: { from: 'employees', localField: 'assignedTo', foreignField: '_id', as: 'assignedTo' } },
            { $lookup: { from: 'employees', localField: 'createdBy', foreignField: '_id', as: 'createdBy' } }
          ],
          as: 'recurringInstances'
        }
      },
      // Compute overdue (unchanged)
      {
        $addFields: {
          isOverdue: {
            $and: [
              { $lt: ['$endDateTime', new Date()] },
              { $ne: ['$status', 'completed'] },
              { $or: [
                { $eq: ['$repeatFrequency', 'daily'] },
                { $eq: ['$repeat', false] }
              ] }
            ]
          }
        }
      },
      { $sort: { createdAt: -1 } }
    ]);

    console.log('🔍 Aggregation results length:', aggregation.length);  // Log

    // Flatten: Add children as separate entries (unchanged)
    const allTasks = [];
    aggregation.forEach(parent => {
      allTasks.push({
        ...parent,
        isRecurringInstance: false,  // Flag parent
        isOverdue: parent.isOverdue
      });
      // Add children
      parent.recurringInstances.forEach(child => {
        allTasks.push({
          ...child,
          isRecurringInstance: true,
          parentTitle: parent.title,  // For UI
          isOverdue: child.endDateTime < new Date() && child.status !== 'completed'
        });
      });
    });

    // Final sort (unchanged)
    allTasks.sort((a, b) => new Date(b.startDateTime || b.createdAt) - new Date(a.startDateTime || a.createdAt));

    console.log(`📦 Returning ${allTasks.length} tasks, sample title:`, allTasks[0]?.title);  // Log final output

    res.json({ tasks: allTasks });
  } catch (error) {
    console.error('Get all tasks error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// Updated getTaskById to include children if parent
exports.getTaskById = async (req, res) => {
  try {
    const { id } = req.params;
    const company = await getCompanyIdFromUser  (req.user);
    let task = await Task.findOne({ _id: id, company })
      .populate('assignedTo', 'firstName role')
      .populate('createdBy', 'firstName role');
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    // NEW: If parent with repeat, fetch children
    let recurringInstances = [];
    if (task.repeat) {
      recurringInstances = await Task.find({ parentTask: id })
        .populate('assignedTo', 'firstName role')
        .populate('createdBy', 'firstName role')
        .sort({ startDateTime: 1 });
      // Compute overdue for children
      const oneDayMs = 24 * 60 * 60 * 1000;
      recurringInstances = recurringInstances.map(child => ({
        ...child.toObject(),
        isOverdue: child.endDateTime < new Date(Date.now() - oneDayMs) && child.status !== 'completed',
      }));
    }
  // Compute overdue for main task
    const taskWithOverdue = { ...task.toObject(), isOverdue: task.isOverdue };
    res.json({ 
      task: taskWithOverdue, 
      recurringInstances  // Array of children
    });
  } catch (error) {
    console.error('Get task by ID error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};



exports.updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const company = await getCompanyIdFromUser (req.user);
    const updateData = req.body;
    console.log("updateData", updateData);

    // Validate repeat fields if updated - unchanged
    if (updateData.repeat) {
      if (!updateData.repeatFrequency || !['daily', 'weekly', 'monthly'].includes(updateData.repeatFrequency)) {
        return res.status(400).json({ message: 'repeatFrequency must be one of daily, weekly, or monthly when repeat is true' });
      }
      if (updateData.repeatFrequency === 'weekly') {
        if (!Array.isArray(updateData.repeatDaysOfWeek) || updateData.repeatDaysOfWeek.length === 0) {
          return res.status(400).json({ message: 'repeatDaysOfWeek must be a non-empty array when repeatFrequency is weekly' });
        }
        for (const day of updateData.repeatDaysOfWeek) {
          if (!validWeekDays.includes(day)) {
            return res.status(400).json({ message: `Invalid day in repeatDaysOfWeek: ${day}` });
          }
        }
      }
      if (updateData.repeatFrequency === 'monthly') {
        if (!Array.isArray(updateData.repeatDatesOfMonth) || updateData.repeatDatesOfMonth.length === 0) {
          return res.status(400).json({ message: 'repeatDatesOfMonth must be a non-empty array when repeatFrequency is monthly' });
        }
        for (const date of updateData.repeatDatesOfMonth) {
          if (typeof date !== 'number' || date < 1 || date > 31) {
            return res.status(400).json({ message: `Invalid date in repeatDatesOfMonth: ${date}` });
          }
        }
      }
      if (!updateData.nextFinishDateTime) {
        return res.status(400).json({ message: 'nextFinishDateTime is required when repeat is true' });
      }
    } else if (updateData.repeat === false) {
      if (!updateData.nextFollowUpDateTime) {
        return res.status(400).json({ message: 'nextFollowUpDateTime is required when repeat is false' });
      }
    }

    // Validate assignedTo if updated - unchanged
    if (updateData.assignedTo) {
      const assignedToArray = Array.isArray(updateData.assignedTo) ? updateData.assignedTo : [updateData.assignedTo];
      const assignees = await Employee.find({ _id: { $in: assignedToArray }, company });
      if (assignees.length !== assignedToArray.length) {
        return res.status(400).json({ message: 'One or more assigned users not found in your company' });
      }
      updateData.assignedTo = assignedToArray;
    }

    // Fetch existing
    const existingTask = await Task.findOne({ _id: id, company });
    if (!existingTask) {
      return res.status(404).json({ message: 'Task not found or not authorized' });
    }
    
    // Apply updates
    const updatedTaskData = { 
      ...existingTask.toObject(), 
      ...updateData, 
      updatedAt: new Date(),
      isRecurringInstance: false,  // Keep false (assuming updating parent/one-time)
      recurrenceActive: updateData.repeat ? true : false  // Active only if recurring
    };
    
    const task = await Task.findByIdAndUpdate(id, updatedTaskData, { new: true, runValidators: true });
    
    // FIXED: No auto-regeneration of instances on update - just update the task
    // (If repeat changed to true, instances can be generated later via endpoint)
    console.log(`Task updated: ID ${id}, new repeat: ${task.repeat}`);

    await task.populate('assignedTo', 'firstName lastName role');
    await task.populate('createdBy', 'firstName lastName role');
    
    res.json({ message: 'Task updated successfully', task });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update deleteTask (replace existing function - handles series deletion)
exports.deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    const company = await getCompanyIdFromUser (req.user);
    const deleteSeries = req.query.deleteSeries === 'true';  // NEW: Query param for series deletion
    if (deleteSeries) {
      // NEW: Delete entire series (parent + all children)
      const parentTask = await Task.findOne({ _id: id, company, repeat: true, isRecurringInstance: { $ne: true } });
      if (!parentTask) {
        return res.status(404).json({ message: 'Recurring parent task not found for series deletion' });
      }
      // Delete all children
      await Task.deleteMany({ parentTask: id });
      // Delete parent
      await Task.findByIdAndDelete(id);
      res.json({ message: 'Entire recurring series deleted successfully (parent + all instances)' });
    } else {
      // Existing: Delete single task (or child)
      const task = await Task.findOneAndDelete({ _id: id, company });
      if (!task) {
        return res.status(404).json({ message: 'Task not found or not authorized' });
      }
      // If deleting a parent without series flag, still delete children (safety)
      if (task.repeat) {
        await Task.deleteMany({ parentTask: id });
      }
      res.json({ message: 'Task deleted successfully' });
    }
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};



exports.shiftedTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { assignedTo, description, nextFollowUp } = req.body;
    const shiftedBy = req.user.id || req.user.userId; // from auth middleware
console.log(" req.body-------", req.body);

    console.log("req.user",req.user);
    if (!assignedTo) {
      return res.status(400).json({ message: 'New assignee ID(s) is required' });
    }

    // Find the task
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Normalize assignedTo and oldAssigneeId as arrays
    const oldAssigneeIds = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
    const newAssignedToArray = Array.isArray(assignedTo) ? assignedTo : [assignedTo];

    // Update assignedTo and optionally nextFollowUpDateTime
    task.assignedTo = newAssignedToArray;

    if (nextFollowUp) {
      const nextFollowUpDate = new Date(nextFollowUp);
      if (isNaN(nextFollowUpDate)) {
        return res.status(400).json({ message: 'Invalid nextFollowUp date' });
      }
      task.nextFollowUpDateTime = nextFollowUpDate;
    }

    console.log("nextFollowUp",nextFollowUp);
    

    await task.save();

    // Create status update entry
    const statusUpdate = new TaskStatusUpdate({
      task: taskId,
      status: 'reassigned',
      description: description || `Task reassigned from ${oldAssigneeIds.join(', ')} to ${newAssignedToArray.join(', ')}`,
      nextFollowUpDateTime: nextFollowUp ? new Date(nextFollowUp) : undefined,
      shiftedBy,
      oldAssigneeId: oldAssigneeIds.length === 1 ? oldAssigneeIds[0] : oldAssigneeIds,
      assignedTo: newAssignedToArray.length === 1 ? newAssignedToArray[0] : newAssignedToArray,
    });

    await statusUpdate.save();

    res.json({ message: 'Task reassigned successfully', task, statusUpdate });
  } catch (error) {
    console.error('Reassign task error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};




exports.getTasksByEmployeeId = async (req, res) => {
  try {
    const { employeeId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({ message: 'Invalid employee ID' });
    }

    const tasks = await Task.find({ assignedTo: employeeId })
      .populate('assignedTo', 'firstName lastName role')
      .populate('createdBy', 'firstName lastName role')
      .populate('department', 'name') // adjust fields as per your schema
      .sort({ createdAt: -1 });

    res.json({ tasks });
  } catch (error) {
    console.error('Get tasks by employee ID error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};





// Get credit points task-wise (list tasks with credit points and assigned employees)
exports.getCreditPointsTaskWise = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser (req.user);

    // Find tasks for company, select creditPoints and assignedTo
    const tasks = await Task.find({ company })
      .select('title creditPoints assignedTo')
      .populate('assignedTo', 'firstName lastName role');

    // Format response: each task with creditPoints and assigned employees
    const result = tasks.map(task => ({
      taskId: task._id,
      title: task.title,
      creditPointsPerEmployee: task.creditPoints || 0,
      assignedEmployees: task.assignedTo.map(emp => ({
        employeeId: emp._id,
        name: `${emp.firstName} ${emp.lastName}`,
        role: emp.role,
        creditPoints: task.creditPoints || 0, // each assigned employee gets full creditPoints
      })),
    }));

    res.json({ tasks: result });
  } catch (error) {
    console.error('Get credit points task-wise error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get credit points employee-wise (sum credit points from all tasks assigned to employee)
exports.getCreditPointsEmployeeWise = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser (req.user);

    // Aggregate tasks grouped by assignedTo employees
    // Since assignedTo is an array, unwind it first
    const aggregation = await Task.aggregate([
      { $match: { company: mongoose.Types.ObjectId(company) } },
      { $unwind: '$assignedTo' },
      {
        $group: {
          _id: '$assignedTo',
          totalCreditPoints: { $sum: '$creditPoints' }
        }
      },
      {
        $lookup: {
          from: 'employees',
          localField: '_id',
          foreignField: '_id',
          as: 'employee'
        }
      },
      { $unwind: '$employee' },
      {
        $project: {
          _id: 0,
          employeeId: '$_id',
          name: { $concat: ['$employee.firstName', ' ', '$employee.lastName'] },
          role: '$employee.role',
          totalCreditPoints: 1
        }
      },
      { $sort: { totalCreditPoints: -1 } }
    ]);

    res.json({ employees: aggregation });
  } catch (error) {
    console.error('Get credit points employee-wise error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};