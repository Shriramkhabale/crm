// controller/taskController.js

const Task = require('../models/Task');
const Employee = require('../models/Employee');
const TaskStatusUpdate = require('../models/TaskStatusUpdate');
const Holiday = require('../models/Holiday'); 
const mongoose = require('mongoose');

async function getCompanyIdFromUser (user) {
  if (user.role === 'company') {
    return user.userId; 
  } else {
    const employee = await Employee.findById(user.userId).select('company');
    if (!employee) throw new Error('Employee not found');
    return employee.company.toString();
  } 
}

const validWeekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// NEW: Helper to fetch holidays for a period (uses your existing schema: company, name, date)
async function getHolidaysForPeriod(companyId, startDate, endDate) {
  try {
    const holidays = await Holiday.find({
      company: new mongoose.Types.ObjectId(companyId),
      date: { $gte: startDate, $lte: endDate }
    }).select('date name').sort({ date: 1 });
    console.log(`Fetched ${holidays.length} holidays for period ${startDate.toISOString()} to ${endDate.toISOString()}`);
    return holidays;
  } catch (error) {
    console.error('Error fetching holidays:', error);
    return [];  // Graceful fallback - no holidays means no shifts
  }
}

// NEW: Check if a date is a holiday (compares YYYY-MM-DD to avoid time issues)
function isHoliday(checkDate, holidays) {
  const dateStr = checkDate.toISOString().split('T')[0];  // YYYY-MM-DD
  return holidays.some(holiday => {
    const holidayStr = holiday.date.toISOString().split('T')[0];
    return dateStr === holidayStr;
  });
}


const LOOKAHEAD_DAYS = 3;

async function generateRecurringInstances(parentTaskData, companyId) {
  if (!parentTaskData.repeat || !parentTaskData.recurrenceActive || !parentTaskData.nextFinishDateTime) {
    console.log('Skipping generation: repeat disabled or no end date');
    return [];
  }

  const instances = [];
  const startDate = new Date(parentTaskData.startDateTime);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(parentTaskData.nextFinishDateTime);
  endDate.setHours(23, 59, 59, 999);

  const companyObjId = new mongoose.Types.ObjectId(companyId);

  // Fetch holidays for the entire period
  const holidays = await getHolidaysForPeriod(companyId, startDate, endDate);

  let currentDate = new Date(startDate);
  let iterations = 0;
  const maxIterations = 1000; // Safety limit

  while (currentDate <= endDate && iterations < maxIterations) {
    iterations++;

    let shouldCreate = false;

    if (parentTaskData.repeatFrequency === 'daily') {
      shouldCreate = true;
    } else if (parentTaskData.repeatFrequency === 'weekly') {
      const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
      shouldCreate = parentTaskData.repeatDaysOfWeek.includes(dayName);
    } else if (parentTaskData.repeatFrequency === 'monthly') {
      const dayNum = currentDate.getDate();
      shouldCreate = parentTaskData.repeatDatesOfMonth.includes(dayNum);
    }

    if (shouldCreate) {
      const instance = await createInstance(currentDate, parentTaskData, parentTaskData._id, companyObjId, endDate, holidays);
      if (instance) instances.push(instance);
    }

    // Increment date by 1 day for daily and weekly
    if (parentTaskData.repeatFrequency === 'daily' || parentTaskData.repeatFrequency === 'weekly') {
      currentDate.setDate(currentDate.getDate() + 1);
    } else if (parentTaskData.repeatFrequency === 'monthly') {
      // For monthly, increment month and reset date to 1
      currentDate.setMonth(currentDate.getMonth() + 1);
      currentDate.setDate(1);
    }
  }

  if (iterations >= maxIterations) {
    console.warn('Max iterations reached in generateRecurringInstances');
  }

  console.log(`Generated ${instances.length} recurring instances for task ${parentTaskData._id}`);
  return instances;
}



// Helper to calculate the NEXT scheduled date (unchanged - future only)
function calculateNextInstanceDate(parentTask, currentDate) {
  const freq = parentTask.repeatFrequency;
  let nextDate = new Date(currentDate);
  nextDate.setHours(0, 0, 0, 0);  
  
  if (freq === 'daily') {
    const todayStart = new Date(nextDate);
    todayStart.setHours(parentTask.startDateTime.getHours(), parentTask.startDateTime.getMinutes(), 0, 0);
    if (currentDate > todayStart) {
      nextDate.setDate(nextDate.getDate() + 1);  
    }
    return nextDate;
    
  } else if (freq === 'weekly') {
    const daysMap = { 'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6 };
    let daysFromNow = 7;  
    parentTask.repeatDaysOfWeek.forEach(dayName => {
      const targetDay = daysMap[dayName];
      const currentDay = nextDate.getDay();
      let diff = (targetDay - currentDay + 7) % 7;
      if (diff === 0) diff = 7;  
      if (diff < daysFromNow) daysFromNow = diff;
    });
    nextDate.setDate(nextDate.getDate() + daysFromNow);
    return nextDate;
    
  } else if (freq === 'monthly') {
    let year = nextDate.getFullYear();
    let month = nextDate.getMonth();
    let day = nextDate.getDate();
    
    let found = false;
    while (!found) {
      for (const dayNum of parentTask.repeatDatesOfMonth.sort((a, b) => a - b)) {
        const testDate = new Date(year, month, dayNum);
        if (testDate.getMonth() === month && testDate >= nextDate) {  
          nextDate = testDate;
          found = true;
          break;
        }
      }
      if (!found) {
        month++;
        if (month > 11) {
          month = 0;
          year++;
        }
        nextDate = new Date(year, month, 1);  
      }
    }
    return nextDate;
  }
  
  return null;  
}

// UPDATED: createInstance (NEW: Check for holiday and shift to one day before)
async function createInstance(instanceDate, parentTaskData, parentId, companyObjId, endDateTime, holidays) {
  try {
    let workingDate = new Date(instanceDate);
    workingDate.setHours(0, 0, 0, 0);

    const now = new Date();
    now.setSeconds(0, 0, 0, 0);

    // Skip if instance date is before now (past)
    if (workingDate < now) {
      console.log(`Skipping past date: ${workingDate.toISOString()}`);
      return null;
    }

    const taskStartDate = new Date(parentTaskData.startDateTime);
    taskStartDate.setHours(0, 0, 0, 0);

    // Recursive shift for holidays and before task start date
    while (isHoliday(workingDate, holidays) || workingDate < taskStartDate) {
      workingDate.setDate(workingDate.getDate() - 1);
      workingDate.setHours(0, 0, 0, 0);

      if (workingDate < now) {
        console.log(`Shifted date is in past, skipping instance`);
        return null;
      }
    }

    // Set start and end times based on parent task
    const startDt = new Date(workingDate);
    startDt.setHours(parentTaskData.startDateTime.getHours(), parentTaskData.startDateTime.getMinutes(), 0, 0);

    const endDt = new Date(workingDate);
    endDt.setHours(parentTaskData.endDateTime.getHours(), parentTaskData.endDateTime.getMinutes(), 59, 999);

    if (endDt > endDateTime || startDt > endDateTime) {
      console.log(`Skipping beyond end date: ${startDt.toISOString()}`);
      return null;
    }

    // Check for existing instance to prevent duplicates
    const existing = await Task.findOne({
      parentTask: parentId,
      startDateTime: startDt,
      company: companyObjId
    });
    if (existing) {
      console.log(`Existing instance found for date: ${startDt.toISOString()}`);
      return existing;
    }

    // For monthly recurrence, validate day after shift
    if (parentTaskData.repeatFrequency === 'monthly') {
      const expectedDay = workingDate.getDate();
      if (!parentTaskData.repeatDatesOfMonth.includes(expectedDay)) {
        console.log(`Invalid monthly day after shift: ${expectedDay} (not in selected dates)`);
        return null;
      }
    }

    // Create new recurring instance
    const instance = new Task({
      title: parentTaskData.title,
      description: parentTaskData.description,
      department: parentTaskData.department,
      assignedTo: parentTaskData.assignedTo,
      startDateTime: startDt,
      endDateTime: endDt,
      status: 'pending',
      creditPoints: parentTaskData.creditPoints,
      priority: parentTaskData.priority,
      company: parentTaskData.company,
      createdBy: parentTaskData.createdBy,
      images: parentTaskData.images || [],
      audios: parentTaskData.audios || [],
      files: parentTaskData.files || [],
      parentTask: parentId,
      isRecurringInstance: true,
      recurrenceActive: parentTaskData.recurrenceActive
    });

    await instance.save();

    const shiftMsg = isHoliday(instanceDate, holidays) ? 'shifted ' : '';
    console.log(`Created ${shiftMsg}instance: ${startDt.toISOString()} to ${endDt.toISOString()}`);

    return instance;
  } catch (error) {
    console.error(`Error creating instance for ${instanceDate.toISOString()}:`, error);
    return null;
  }
}



// stopRecurrence (unchanged)
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

// resumeRecurrence (unchanged - generates next only)
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
    const instances = await generateRecurringInstances(task.toObject(), company, true);  
    res.json({ message: 'Recurrence resumed. Next instance generated.', task, newInstances: instances.length });
  } catch (error) {
    console.error('Resume recurrence error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};



// NEW: Check if a date is a holiday (compares YYYY-MM-DD to avoid time issues)
function isHoliday(checkDate, holidays) {
  const dateStr = checkDate.toISOString().split('T')[0];  // YYYY-MM-DD
  return holidays.some(holiday => {
    const holidayStr = holiday.date.toISOString().split('T')[0];
    return dateStr === holidayStr;
  });
}


// createTask (unchanged - saves only parent)
exports.createTask = async (req, res) => {
  try {
    const {
      title, description, department, assignedTo, startDateTime, endDateTime, repeat, creditPoints,
      repeatFrequency, repeatDaysOfWeek, repeatDatesOfMonth, priority, nextFollowUpDateTime,
      nextFinishDateTime, createdBy, status, company: bodyCompany
    } = req.body;
    const company = req.user.companyId || bodyCompany || req.user.userId;
    
    if (!title || !department || !assignedTo || !startDateTime || !endDateTime) {
      return res.status(400).json({ message: 'Title, department, assignedTo, startDateTime, and endDateTime are required' });
    }
    const assignedToArray = Array.isArray(assignedTo) ? assignedTo : [assignedTo];
    const assignee = await Employee.find({ _id: { $in: assignedToArray }, company: company.toString() });
    if (assignee.length !== assignedToArray.length) {
      return res.status(400).json({ message: 'One or more assigned users not found in your company' });
    }
    
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
    // (Instances generated on-demand in getAllTasks)
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

// UPDATED: getAllTasks (key change: Fetch ALL instances via $lookup, generate next if missing)
exports.getAllTasks = async (req, res) => {
  try {
    console.log('🔍 getAllTasks - Query params:', req.query);  

    const companyStr = await getCompanyIdFromUser  (req.user);  
    if (!companyStr) {
      return res.status(400).json({ message: 'Company ID not found in user data' });
    }

    const companyObjId = new mongoose.Types.ObjectId(companyStr);
    console.log('🔍 Resolved company (string):', companyStr, ' (ObjectId):', companyObjId);  

    // Base filters: Always include company as ObjectId
    let filters = { 
      company: companyObjId,  
      isRecurringInstance: { $ne: true }  // Parents/non-recurring by default (fetch children separately via lookup)
    };

    // Apply other query filters (existing)
    if (req.query.assignedTo) filters.assignedTo = new mongoose.Types.ObjectId(req.query.assignedTo);
    if (req.query.createdBy) filters.createdBy = new mongoose.Types.ObjectId(req.query.createdBy);
    if (req.query.department) filters.department = new mongoose.Types.ObjectId(req.query.department);
    if (req.query.priority) filters.priority = req.query.priority;
    if (req.query.repeat !== undefined) filters.repeat = req.query.repeat === 'true';

    console.log('🔍 Initial filters:', JSON.stringify(filters, null, 2));  

    // Recurring filter logic (unchanged)
    const recurringFilter = req.query.recurring;  
    if (recurringFilter === 'recurring') {
      filters.repeat = true;
      filters.recurrenceActive = true;
    } else if (recurringFilter === 'non-recurring') {
      filters.$or = [
        { repeat: { $ne: true } },  
        { isRecurringInstance: true },  
        { recurrenceActive: false }  
      ];
      delete filters.isRecurringInstance;  
    } else if (recurringFilter === 'all') {
      filters = { company: companyObjId };  
    }

    console.log('🔍 Final filters after recurring:', JSON.stringify(filters, null, 2));  

    // UPDATED: Aggregation pipeline - $lookup fetches ALL instances (no date filter for past/future)
    const aggregation = await Task.aggregate([
      { $match: filters },
      {
        $lookup: {
          from: 'tasks',  
          let: { parentId: '$_id' },
          pipeline: [
            { 
              $match: { 
                $expr: { $eq: ['$parentTask', '$$parentId'] }, 
                company: companyObjId  // Ensure company match
              } 
            },
            // FIXED: No date filter - fetches ALL instances (past + future)
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

    console.log('🔍 Aggregation results length:', aggregation.length);  

    // UPDATED: For each recurring parent, check/generate next future instance if missing
    // (Past instances are already fetched via lookup; only add future if needed)
    const allTasks = [];
    for (const parent of aggregation) {
      // Add parent to list
      allTasks.push({
        ...parent,
        isRecurringInstance: false,  
        isOverdue: parent.isOverdue
      });

      // FIXED: Fetch all existing instances (past + future) from lookup
      const existingInstances = parent.recurringInstances || [];
      console.log(`🔍 Parent ${parent._id}: Found ${existingInstances.length} existing instances`);

      // Add all existing instances (past + any future)
      existingInstances.forEach(child => {
        allTasks.push({
          ...child,
          isRecurringInstance: true,
          parentTitle: parent.title,  
          isOverdue: child.endDateTime < new Date() && child.status !== 'completed'
        });
      });

     // NEW: If recurring and active, check if next future instance exists; generate if missing
if (parent.repeat && parent.recurrenceActive && parent.nextFinishDateTime) {
  const now = new Date();
  const nextDate = calculateNextInstanceDate(parent, now);  // FIXED: Use parent (aggregation object)
  const endDate = new Date(parent.nextFinishDateTime);

  if (nextDate && nextDate <= endDate) {
    // Check if next instance already exists (by startDateTime)
    const nextStartTime = new Date(nextDate);
    nextStartTime.setHours(parent.startDateTime.getHours(), parent.startDateTime.getMinutes(), 0, 0);
    
    const nextExists = existingInstances.some(child => 
      new Date(child.startDateTime).getTime() === nextStartTime.getTime()
    );

    if (!nextExists) {
      console.log(`🔍 Generating missing next instance for parent ${parent._id} on ${nextStartTime.toISOString()}`);
      // const newInstances = await generateRecurringInstances(parent.toObject(), companyStr, true);  // FIXED: Use .toObject() for plain data
     
      const newInstances = await generateRecurringInstances(parent, companyStr, true);
     
      if (newInstances.length > 0) {
        // Add the new next instance to the list (fresh fetch not needed since just created)
        const newChild = newInstances[0];
        allTasks.push({
          ...newChild,
          isRecurringInstance: true,
          parentTitle: parent.title,
          isOverdue: false  // Future, so not overdue
        });
        console.log(`🔍 Added new next instance to response`);
      }
    } else {
      console.log(`🔍 Next instance already exists for parent ${parent._id}`);
    }
  } else {
    console.log(`🔍 No next instance needed for parent ${parent._id} (beyond end or invalid)`);
  }
}

    }

    // Final sort: By startDateTime descending (recent/past first, then future)
    allTasks.sort((a, b) => new Date(b.startDateTime || b.createdAt) - new Date(a.startDateTime || a.createdAt));

    console.log(`📦 Returning ${allTasks.length} tasks (including all past instances), sample title:`, allTasks[0]?.title);  

    res.json({ tasks: allTasks });
  } catch (error) {
    console.error('Get all tasks error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// UPDATED: getTaskById (fetch ALL instances for parent, including past)
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
    
    // UPDATED: Fetch ALL instances (past + future) if parent
    let recurringInstances = [];
    if (task.repeat) {
      recurringInstances = await Task.find({ parentTask: id, company })
        .populate('assignedTo', 'firstName role')
        .populate('createdBy', 'firstName role')
        .sort({ startDateTime: 1 });  // Chronological order (past to future)
      
      // FIXED: No date filter - includes all past/future
      console.log(`🔍 Fetched ${recurringInstances.length} instances for task ${id} (all past + future)`);
      
      // Compute overdue for all instances
      recurringInstances = recurringInstances.map(child => ({
        ...child.toObject(),
        isOverdue: child.endDateTime < new Date() && child.status !== 'completed',
      }));
      
      // NEW: Generate next if missing (similar to getAllTasks)
const now = new Date();
const nextDate = calculateNextInstanceDate(task.toObject(), now);  // FIXED: Use .toObject()
const endDate = new Date(task.nextFinishDateTime);

if (task.recurrenceActive && nextDate && nextDate <= endDate) {
  const nextStartTime = new Date(nextDate);
  nextStartTime.setHours(task.startDateTime.getHours(), task.startDateTime.getMinutes(), 0, 0);
  
  const nextExists = recurringInstances.some(child => 
    new Date(child.startDateTime).getTime() === nextStartTime.getTime()
  );
  
  if (!nextExists) {
    console.log(`🔍 Generating missing next instance for single task view ${id}`);
    // const newInstances = await generateRecurringInstances(task.toObject(), company, true);  // FIXED: Use .toObject()
    const newInstances = await generateRecurringInstances(task, company, true);
    if (newInstances.length > 0) {
      const newChild = newInstances[0];
      recurringInstances.push({
        ...newChild,
        isOverdue: false
      });
      recurringInstances.sort((a, b) => new Date(a.startDateTime) - new Date(b.startDateTime));
    }
  }
}

    }
    
    // Compute overdue for main task
    const taskWithOverdue = { ...task.toObject(), isOverdue: task.endDateTime < new Date() && task.status !== 'completed' };
    res.json({ 
      task: taskWithOverdue, 
      recurringInstances  // All instances (past + future)
    });
  } catch (error) {
    console.error('Get task by ID error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// updateTask (unchanged - updates parent, preserves existing instances)
exports.updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const company = await getCompanyIdFromUser  (req.user);
    const updateData = req.body;
    console.log("updateData", updateData);

    // Validate repeat fields if updated (unchanged)
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

    // Validate assignedTo if updated (unchanged)
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
    
    // Apply updates (preserves existing instances - no auto-regen)
    const updatedTaskData = { 
      ...existingTask.toObject(), 
      ...updateData, 
      updatedAt: new Date(),
      isRecurringInstance: false,  
      recurrenceActive: updateData.repeat ? true : false  
    };
    
    const task = await Task.findByIdAndUpdate(id, updatedTaskData, { new: true, runValidators: true });
    
    console.log(`Task updated: ID ${id}, new repeat: ${task.repeat}`);

    await task.populate('assignedTo', 'firstName lastName role');
    await task.populate('createdBy', 'firstName lastName role');
    
    res.json({ message: 'Task updated successfully', task });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// deleteTask (unchanged - deletes parent + all instances if series)
exports.deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    const company = await getCompanyIdFromUser  (req.user);
    const deleteSeries = req.query.deleteSeries === 'true';  
    if (deleteSeries) {
      const parentTask = await Task.findOne({ _id: id, company, repeat: true, isRecurringInstance: { $ne: true } });
           if (!parentTask) {
        return res.status(404).json({ message: 'Recurring parent task not found for series deletion' });
      }
      // Delete all children (past + future instances)
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
      // If deleting a parent without series flag, still delete children (safety - includes past)
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

// shiftedTask (unchanged - handles reassignment, works with instances too)
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

    // Find the task (works for parent or instance)
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

// getTasksByEmployeeId (unchanged - fetches all tasks assigned to employee, including instances)
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

// Get credit points task-wise (unchanged - includes all tasks/instances)
exports.getCreditPointsTaskWise = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser   (req.user);

    // Find tasks for company, select creditPoints and assignedTo
    const tasks = await Task.find({ company: new mongoose.Types.ObjectId(company) })  // FIXED: Cast to ObjectId
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

// Get credit points employee-wise (unchanged - sums across all tasks/instances)
exports.getCreditPointsEmployeeWise = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser   (req.user);

    // Aggregate tasks grouped by assignedTo employees
    // Since assignedTo is an array, unwind it first
    const aggregation = await Task.aggregate([
   { $match: { company: new mongoose.Types.ObjectId(company) } }, 
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
