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
// UPDATED: Fetch holidays for a period (optimized for date-only matching)
async function getHolidaysForPeriod(companyId, startDate, endDate) {
  try {
    const holidays = await Holiday.find({
      company: new mongoose.Types.ObjectId(companyId),
      date: { $gte: startDate, $lte: endDate }
    }).select('date name').sort({ date: 1 });
    console.log(`Fetched ${holidays.length} holidays for period ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
    return holidays;
  } catch (error) {
    console.error('Error fetching holidays:', error);
    return [];  // Graceful fallback
  }
}


// UPDATED: Check if a date is a holiday (date-only comparison)
function isHoliday(checkDate, holidays) {
  if (!checkDate || !holidays || holidays.length === 0) return false;
  const dateStr = checkDate.toISOString().split('T')[0];  // YYYY-MM-DD
  return holidays.some(holiday => holiday.date.toISOString().split('T')[0] === dateStr);
}


const LOOKAHEAD_DAYS = 3;

async function generateRecurringInstances(parentTaskData, companyId, generateNextOnly = false) {
  if (!parentTaskData.repeat || !parentTaskData.recurrenceActive || !parentTaskData.nextFinishDateTime) {
    console.log('Skipping generation: repeat disabled or no end date');
    return [];
  }

  const companyObjId = new mongoose.Types.ObjectId(companyId);
  const holidays = await getHolidaysForPeriod(companyId, new Date(), new Date(parentTaskData.nextFinishDateTime));

  if (generateNextOnly) {
    // Calculate next instance date after now
    const now = new Date();
    const nextDate = calculateNextInstanceDate(parentTaskData, now);
    if (!nextDate) {
      console.log('No next date calculated');
      return [];
    }

    const endDate = new Date(parentTaskData.nextFinishDateTime);
    if (nextDate > endDate) {
      console.log('Next date beyond recurrence end date');
      return [];
    }

    // Check if instance already exists
    const startDt = new Date(nextDate);
    startDt.setHours(parentTaskData.startDateTime.getHours(), parentTaskData.startDateTime.getMinutes(), 0, 0);

    const existing = await Task.findOne({
      parentTask: parentTaskData._id,
      startDateTime: startDt,
      company: companyObjId
    });

    if (existing) {
      console.log('Next instance already exists:', startDt.toISOString());
      return [];
    }

    // Create instance
    const instance = await createInstance(nextDate, parentTaskData, parentTaskData._id, companyObjId, endDate, holidays);
    return instance ? [instance] : [];
  } else {
    // Original logic to generate all instances between start and end dates (if you want)
    // But per your requirement, you probably won't call this without generateNextOnly=true
    return [];
  }
}


// NEW: Shift date to previous non-holiday working day (recursive, stops at startDate)
function shiftToPreviousNonHoliday(date, holidays, minStartDate) {
  let shiftedDate = new Date(date);
  shiftedDate.setHours(0, 0, 0, 0);  // Date-only

  let attempts = 0;
  const maxAttempts = 7;  // Prevent infinite loop (e.g., week of holidays)

  while (isHoliday(shiftedDate, holidays) && attempts < maxAttempts) {
    shiftedDate.setDate(shiftedDate.getDate() - 1);
    shiftedDate.setHours(0, 0, 0, 0);
    attempts++;

    // Stop if shifted before minStartDate or into past
    if (shiftedDate < minStartDate) {
      console.warn(`Cannot shift ${date.toISOString().split('T')[0]} - before start date`);
      return null;  // Skip this instance
    }
  }

  if (attempts >= maxAttempts) {
    console.warn(`Max shift attempts reached for ${date.toISOString().split('T')[0]}`);
    return null;  // Skip
  }

  console.log(`Shifted ${date.toISOString().split('T')[0]} to ${shiftedDate.toISOString().split('T')[0]} (${attempts} holiday(s) skipped)`);
  return shiftedDate;
}


// Helper to calculate the NEXT scheduled date (unchanged - future only)
function calculateNextInstanceDate(parentTask, currentDate) {
  const freq = parentTask.repeatFrequency;
  let nextDate = new Date(currentDate);
  nextDate.setHours(0, 0, 0, 0);  // Start from today date-only

  // NEW: First, check if TODAY matches the pattern (return today if yes)
  const todayDateOnly = new Date(nextDate);

  if (freq === 'daily') {
    // Daily: Today always matches
    return todayDateOnly;
  } else if (freq === 'weekly') {
    const daysMap = { 'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6 };
    const todayDayNum = todayDateOnly.getDay();
    const matchingDays = parentTask.repeatDaysOfWeek.map(dayName => daysMap[dayName]);
    if (matchingDays.includes(todayDayNum)) {
      // Today matches - return today
      return todayDateOnly;
    }
    // Else, calculate next future matching day
    let daysFromNow = 7;  // Default to next week
    parentTask.repeatDaysOfWeek.forEach(dayName => {
      const targetDay = daysMap[dayName];
      const currentDay = nextDate.getDay();
      let diff = (targetDay - currentDay + 7) % 7;
      if (diff === 0) diff = 7;  // Next week if today (but since today didn't match, this won't trigger)
      if (diff < daysFromNow) daysFromNow = diff;
    });
    nextDate.setDate(nextDate.getDate() + daysFromNow);
    return nextDate;
  } else if (freq === 'monthly') {
    const todayDayNum = todayDateOnly.getDate();
    if (parentTask.repeatDatesOfMonth.includes(todayDayNum)) {
      // Today matches - return today
      return todayDateOnly;
    }
    // Else, calculate next future matching date
    let year = nextDate.getFullYear();
    let month = nextDate.getMonth();
    let found = false;
    while (!found) {
      for (const dayNum of parentTask.repeatDatesOfMonth.sort((a, b) => a - b)) {
        const testDate = new Date(year, month, dayNum);
        if (testDate.getMonth() === month && testDate > nextDate) {  // > nextDate (future only)
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


// UPDATED: Generate single next instance (with holiday shift) - Renamed from generateRecurringInstances
// UPDATED: Generate single instance for due date (today if matching, else next; only if <= today)
async function generateNextInstance(parentTaskData, companyId, holidays, endDateTime) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);  // Today date-only

  const dueDate = calculateNextInstanceDate(parentTaskData, now);  // Now includes today if matching
  if (!dueDate) {
    console.log('No due date calculated for frequency:', parentTaskData.repeatFrequency);
    return null;
  }

  // NEW: Only generate if dueDate <= today (focus on current/past due; future on next call)
  if (dueDate > now) {
    console.log(`Due date ${dueDate.toISOString().split('T')[0]} is in future - will generate on next list call`);
    return null;
  }

  const parentStartDate = new Date(parentTaskData.startDateTime);
  parentStartDate.setHours(0, 0, 0, 0);

  // Shift for holidays if needed (applied to dueDate, e.g., today)
  const workingDate = shiftToPreviousNonHoliday(dueDate, holidays, parentStartDate);
  if (!workingDate) {
    console.log(`Skipping instance for ${dueDate.toISOString().split('T')[0]} - no valid working date after shift`);
    return null;
  }

  // Ensure shifted date is still <= today (don't generate future after shift)
  if (workingDate > now) {
    console.log(`Shifted date ${workingDate.toISOString().split('T')[0]} is now in future - skipping`);
    return null;
  }

  // Skip if beyond end or before start
  const endDate = new Date(endDateTime);
  endDate.setHours(23, 59, 59, 999);
  if (workingDate > endDate || workingDate < parentStartDate) {
    console.log(`Skipping instance: ${workingDate.toISOString().split('T')[0]} outside range`);
    return null;
  }

  // Check if instance already exists (date-only match on workingDate)
  const startDt = new Date(workingDate);
  startDt.setHours(parentTaskData.startDateTime.getHours(), parentTaskData.startDateTime.getMinutes() || 0, 0, 0);
  const existing = await Task.findOne({
    parentTask: parentTaskData._id,
    startDateTime: startDt,
    company: new mongoose.Types.ObjectId(companyId)
  });
  if (existing) {
    console.log(`Instance already exists for ${startDt.toISOString()}`);
    return existing;
  }

  // Validate frequency-specific after shift (e.g., if shifted, check if still matches pattern)
  if (parentTaskData.repeatFrequency === 'monthly') {
    const expectedDays = parentTaskData.repeatDatesOfMonth;
    if (!expectedDays.includes(workingDate.getDate())) {
      console.log(`Invalid monthly day after shift: ${workingDate.getDate()} not in ${expectedDays} - skipping`);
      return null;
    }
  } else if (parentTaskData.repeatFrequency === 'weekly') {
    const daysMap = { 'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6 };
    const workingDayNum = workingDate.getDay();
    const matchingDays = parentTaskData.repeatDaysOfWeek.map(day => daysMap[day]);
    if (!matchingDays.includes(workingDayNum)) {
      console.log(`Invalid weekly day after shift: ${workingDayNum} not in ${matchingDays} - skipping`);
      return null;
    }
  }
  // Daily: Always valid after shift

  // Create instance for workingDate (today or shifted)
  const endDt = new Date(workingDate);
  endDt.setHours(parentTaskData.endDateTime.getHours(), parentTaskData.endDateTime.getMinutes(), 59, 999);

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
    parentTask: parentTaskData._id,
    isRecurringInstance: true,
    recurrenceActive: parentTaskData.recurrenceActive
  });

  await instance.save();
  const shiftMsg = workingDate.toISOString().split('T')[0] !== dueDate.toISOString().split('T')[0] ? '(shifted due to holiday)' : '';
  console.log(`✅ Generated instance for current due date ${dueDate.toISOString().split('T')[0]} → ${startDt.toISOString()} ${shiftMsg}`);
  return instance;
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
// UPDATED: createTask - Save parent + generate first instance if startDateTime matches current date/today (uses new matching logic)
exports.createTask = async (req, res) => {
  try {
    const {
      title, description, department, assignedTo, startDateTime, endDateTime, repeat, creditPoints,
      repeatFrequency, repeatDaysOfWeek, repeatDatesOfMonth, priority, nextFollowUpDateTime,
      createdBy, status, company: bodyCompany
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

    const actualStartDateTime = new Date(startDateTime);
    const actualEndDateTime = new Date(endDateTime);
    const actualNextFinishDateTime = repeat ? actualEndDateTime : undefined;

    if (repeat) {
      if (!repeatFrequency || !['daily', 'weekly', 'monthly'].includes(repeatFrequency)) {
        return res.status(400).json({ message: 'repeatFrequency must be one of daily, weekly, or monthly when repeat is true' });
      }
      if (actualNextFinishDateTime <= actualStartDateTime) {
        return res.status(400).json({ message: 'endDateTime must be after startDateTime for recurring tasks' });
      }
      if (repeatFrequency === 'weekly') {
        if (!Array.isArray(repeatDaysOfWeek) || repeatDaysOfWeek.length === 0) {
          return res.status(400).json({ message: 'repeatDaysOfWeek must be a non-empty array when repeatFrequency is weekly' });
        }
        repeatDaysOfWeek.forEach(day => {
          if (!validWeekDays.includes(day)) {
            return res.status(400).json({ message: `Invalid day in repeatDaysOfWeek: ${day}` });
          }
        });
      }
      if (repeatFrequency === 'monthly') {
        if (!Array.isArray(repeatDatesOfMonth) || repeatDatesOfMonth.length === 0) {
          return res.status(400).json({ message: 'repeatDatesOfMonth must be a non-empty array when repeatFrequency is monthly' });
        }
        repeatDatesOfMonth.forEach(date => {
          if (typeof date !== 'number' || date < 1 || date > 31) {
            return res.status(400).json({ message: `Invalid date in repeatDatesOfMonth: ${date}` });
          }
        });
      }
    } else {
      if (!nextFollowUpDateTime) {
        return res.status(400).json({ message: 'nextFollowUpDateTime is required when repeat is false' });
      }
    }

    // Files (unchanged)
    const images = req.files?.images ? req.files.images.map(f => f.path) : [];
    const audios = req.files?.audios ? req.files.audios.map(f => f.path) : [];
    const files = req.files?.files ? req.files.files.map(f => f.path) : [];

    const taskData = {
      title, description, department, assignedTo: assignedToArray,
      startDateTime: actualStartDateTime, endDateTime: actualEndDateTime,
      repeat, creditPoints, repeatFrequency: repeat ? repeatFrequency : undefined,
      repeatDaysOfWeek: repeat && repeatFrequency === 'weekly' ? repeatDaysOfWeek : undefined,
      repeatDatesOfMonth: repeat && repeatFrequency === 'monthly' ? repeatDatesOfMonth : undefined,
      priority: priority || 'medium',
      nextFollowUpDateTime: !repeat ? new Date(nextFollowUpDateTime) : undefined,
      nextFinishDateTime: actualNextFinishDateTime,
      company: new mongoose.Types.ObjectId(company), status, createdBy: new mongoose.Types.ObjectId(createdBy),
      images, audios, files,
      isRecurringInstance: false,  // Always false for new tasks (parent or one-time)
      recurrenceActive: repeat ? true : false  // Active only if recurring
    };

    const task = new Task(taskData);
    await task.save();

    let firstInstance = null;
    if (repeat && task.recurrenceActive) {
      // Fetch holidays for the full period
      const holidays = await getHolidaysForPeriod(company, actualStartDateTime, actualNextFinishDateTime);

      // UPDATED: Generate first instance if startDateTime date matches current/today pattern
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startDateOnly = new Date(actualStartDateTime);
      startDateOnly.setHours(0, 0, 0, 0);

      // Use new logic: Check if startDateTime matches the recurrence pattern for "today" (but use startDateTime as base)
      const dueForStart = calculateNextInstanceDate(task.toObject(), startDateOnly);  // Treat startDate as "current" for first check
      if (dueForStart && dueForStart.toISOString().split('T')[0] === startDateOnly.toISOString().split('T')[0] && startDateOnly >= today) {
        firstInstance = await generateNextInstance(task.toObject(), company, holidays, actualNextFinishDateTime);
        if (firstInstance) {
          console.log(`✅ First instance generated on create for start date ${startDateOnly.toISOString().split('T')[0]}: ${firstInstance.startDateTime.toISOString()}`);
        } else {
          console.warn(`⚠️ Could not generate first instance (holiday shift failed or invalid)`);
        }
      } else {
        console.log(`Start date ${startDateOnly.toISOString().split('T')[0]} doesn't match pattern or is in past - first instance will generate on next list call`);
      }
    }

    console.log(`Task created: ${repeat ? 'Recurring parent' : 'One-time task'} with ID ${task._id}, repeat: ${repeat}`);

    // Populate
    await task.populate('assignedTo', 'firstName lastName role');
    await task.populate('createdBy', 'firstName lastName role');

    res.status(201).json({
      message: 'Task created successfully',
      task,
      firstInstance: firstInstance ? { ...firstInstance.toObject(), isRecurringInstance: true } : null
    });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// FIXED: getAllTasks - Removed invalid $addFields in $lookup (undefined $$parentTitle); clean flat instances only
exports.getAllTasks = async (req, res) => {
  try {
    console.log('🔍 getAllTasks - Query params:', req.query);

    const companyStr = await getCompanyIdFromUser  (req.user);
    if (!companyStr) {
      return res.status(400).json({ message: 'Company ID not found in user data' });
    }

    const companyObjId = new mongoose.Types.ObjectId(companyStr);
    console.log('🔍 Resolved company (string):', companyStr, ' (ObjectId):', companyObjId);

    // Base filters (unchanged)
    let filters = {
      company: companyObjId,
      isRecurringInstance: { $ne: true }  // Start with parents/non-recurring
    };

    // Apply other query filters (unchanged)
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
      delete filters.isRecurringInstance;
    }

    console.log('🔍 Final filters after recurring:', JSON.stringify(filters, null, 2));

    // FIXED: Aggregation pipeline - Removed invalid $addFields ($$parentTitle undefined); fetches instances cleanly
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
            // REMOVED: $addFields { parentTitle: '$$parentTitle' } - Not needed; add in JS loop
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

    // UPDATED: Build flat list - Skip pushing parents for recurring; only instances + generated
    const allTasks = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);  // Today date-only
    const instanceIds = new Set();  // Track instance IDs to avoid duplicates

    for (const doc of aggregation) {
      const isRecurringParent = doc.repeat && doc.recurrenceActive && !doc.isRecurringInstance;

      if (isRecurringParent) {
        // For recurring parents: SKIP pushing parent; only push instances + generate next
        console.log(`🔍 Skipping parent push for recurring: ${doc.title} (ID: ${doc._id})`);

        // Add existing instances (deduplicated)
        const existingInstances = doc.recurringInstances || [];
        existingInstances.forEach(child => {
          if (!instanceIds.has(child._id.toString())) {
            instanceIds.add(child._id.toString());
            allTasks.push({
              ...child,
              isRecurringInstance: true,
              parentTitle: doc.title,  // Add parent title to each instance
              isOverdue: child.endDateTime < new Date() && child.status !== 'completed',
              newlyGenerated: false  // Existing, not new
            });
          }
        });

        // Generate/add next due instance if recurring and active (prioritizes today if matching)
        if (doc.nextFinishDateTime) {
          const holidays = await getHolidaysForPeriod(companyStr, doc.startDateTime, doc.nextFinishDateTime);
          const currentInstance = await generateNextInstance(doc, companyStr, holidays, doc.nextFinishDateTime);
          if (currentInstance && !instanceIds.has(currentInstance._id.toString())) {
            instanceIds.add(currentInstance._id.toString());
            allTasks.push({
              ...currentInstance.toObject(),
              isRecurringInstance: true,
              parentTitle: doc.title,
              isOverdue: false,  // New instances are not overdue
              newlyGenerated: true  // Flag for frontend
            });
            console.log(`✅ Added current due instance for parent ${doc._id}: ${currentInstance.startDateTime.toISOString()}`);
          }
        }
      } else {
        // For non-recurring tasks or inactive recurring: Push the doc as-is (single task)
        allTasks.push({ 
          ...doc, 
          isRecurringInstance: false, 
          isOverdue: doc.isOverdue 
        });
        console.log(`🔍 Added non-recurring task: ${doc.title} (ID: ${doc._id})`);
      }
    }

    // Final sort: By startDateTime descending (recent/past first, then future)
    allTasks.sort((a, b) => new Date(b.startDateTime || b.createdAt) - new Date(a.startDateTime || a.createdAt));

    // Remove embedded recurringInstances from final docs (not needed in flat list)
    const cleanTasks = allTasks.map(task => {
      const { recurringInstances, ...cleanTask } = task;
      return cleanTask;
    });

    console.log(`📦 Returning ${cleanTasks.length} tasks (instances only for recurring, no duplicates), sample title:`, cleanTasks[0]?.title);

    res.json({ tasks: cleanTasks });
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
        .sort({ startDateTime: 1 });

      // Generate current due instance if missing and matching (<= today)
      if (task.recurrenceActive && task.nextFinishDateTime) {
        const holidays = await getHolidaysForPeriod(company, task.startDateTime, task.nextFinishDateTime);
        const currentInstance = await generateNextInstance(task.toObject(), company, holidays, task.nextFinishDateTime);
        if (currentInstance) {
          recurringInstances.push({
            ...currentInstance.toObject(),
            isRecurringInstance: true,
            parentTitle: task.title,
            isOverdue: false,
            newlyGenerated: true  // Optional flag
          });
          recurringInstances.sort((a, b) => new Date(a.startDateTime) - new Date(b.startDateTime));
          console.log(`✅ Generated current due instance for task ${id}: ${currentInstance.startDateTime.toISOString()}`);
        }
      }
    }

    // Compute overdue for main task
    const taskWithOverdue = {
      ...task.toObject(),
      isOverdue: task.endDateTime < new Date() && task.status !== 'completed'
    };
    res.json({
      task: taskWithOverdue,
      recurringInstances  // All instances (past + future + newly generated current due)
    });
  } catch (error) {
    console.error('Get task by ID error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// UPDATED: updateTask - Updates parent (future generations use new rules; generates current due if needed after update)
exports.updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const company = await getCompanyIdFromUser  (req.user);
    const updateData = req.body;
    console.log("updateData", updateData);

    // Validate repeat fields if updated (unchanged, but uses endDateTime for recurring end)
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
      if (!updateData.endDateTime || new Date(updateData.endDateTime) <= new Date(updateData.startDateTime)) {
        return res.status(400).json({ message: 'endDateTime must be after startDateTime for recurring tasks' });
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

    // For recurring: Use endDateTime as nextFinishDateTime if updated
    if (updateData.repeat && updateData.endDateTime) {
      updateData.nextFinishDateTime = new Date(updateData.endDateTime);
    }

    // Apply updates (preserves existing instances - no auto-regen of past)
    const updatedTaskData = {
      ...existingTask.toObject(),
      ...updateData,
      updatedAt: new Date(),
      isRecurringInstance: false,
      recurrenceActive: updateData.repeat ? true : false
    };

    const task = await Task.findByIdAndUpdate(id, updatedTaskData, { new: true, runValidators: true });

    // NEW: If recurring and active after update, check/generate current due instance (in case rules changed)
    let currentInstance = null;
    if (task.repeat && task.recurrenceActive && task.nextFinishDateTime) {
      const holidays = await getHolidaysForPeriod(company, task.startDateTime, task.nextFinishDateTime);
      currentInstance = await generateNextInstance(task.toObject(), company, holidays, task.nextFinishDateTime);
      if (currentInstance) {
        console.log(`✅ Generated current due instance after update for task ${id}: ${currentInstance.startDateTime.toISOString()}`);
      }
    }

    console.log(`Task updated: ID ${id}, new repeat: ${task.repeat}, new endDateTime: ${task.endDateTime}`);

    await task.populate('assignedTo', 'firstName lastName role');
    await task.populate('createdBy', 'firstName lastName role');

    res.json({
      message: 'Task updated successfully',
      task,
      currentInstance: currentInstance ? { ...currentInstance.toObject(), isRecurringInstance: true, newlyGenerated: true } : null
    });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};



// deleteTask (unchanged - deletes parent + all instances if series)
// UPDATED: deleteTask - Deletes parent + all instances (past + future) if recurring
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
      const deletedInstances = await Task.deleteMany({ parentTask: id });
      // Delete parent
      await Task.findByIdAndDelete(id);
      res.json({
        message: `Entire recurring series deleted successfully (parent + ${deletedInstances.deletedCount} instances)`,
        deletedInstancesCount: deletedInstances.deletedCount
      });
    } else {
      // Single task deletion (or child instance)
      const task = await Task.findOneAndDelete({ _id: id, company });
      if (!task) {
        return res.status(404).json({ message: 'Task not found or not authorized' });
      }
      let deletedInstancesCount = 0;
      // If deleting a parent without series flag, still delete all children (safety)
      if (task.repeat) {
        const deletedInstances = await Task.deleteMany({ parentTask: id });
        deletedInstancesCount = deletedInstances.deletedCount;
      }
      res.json({
        message: 'Task deleted successfully',
        deletedInstancesCount  // 0 if non-recurring/single
      });
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
