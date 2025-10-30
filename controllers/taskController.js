// controller/taskController.js

const Task = require("../models/Task");
const Counter = require("../models/Counter"); // Import Counter model
const Employee = require("../models/Employee");
const TaskStatusUpdate = require("../models/TaskStatusUpdate");
const Holiday = require("../models/Holiday");
const mongoose = require("mongoose");

// Updated: Helper to get next sequential taskId per company (e.g., T1, T2 for each company)
async function getNextSequenceValue(companyId, sequenceName = "taskid") {
  const fullSequenceName = `${sequenceName}_${companyId}`;
  console.log(`🔢 Getting sequence for: ${fullSequenceName}`);  // Debug log

  const sequenceDoc = await Counter.findByIdAndUpdate(
    fullSequenceName,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  console.log(`✅ Sequence updated: ${fullSequenceName} -> seq: ${sequenceDoc.seq}`);  // Debug log
  return sequenceDoc.seq;
}

async function getCompanyIdFromUser(user) {
  if (user.role === "company") {
    return user.userId;
  } else {
    const employee = await Employee.findById(user.userId).select("company");
    if (!employee) throw new Error("Employee not found");
    return employee.company.toString();
  }
}

const validWeekDays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// UPDATED: Fetch holidays for a period (optimized for date-only matching)
async function getHolidaysForPeriod(companyId, startDate, endDate) {
  try {
    const holidays = await Holiday.find({
      company: new mongoose.Types.ObjectId(companyId),
      date: { $gte: startDate, $lte: endDate },
    })
      .select("date name")
      .sort({ date: 1 });
    return holidays;
  } catch (error) {
    console.error("Error fetching holidays:", error);
    return []; // Graceful fallback
  }
}

// UPDATED: Check if a date is a holiday (date-only comparison)
function isHoliday(checkDate, holidays) {
  if (!checkDate || !holidays || holidays.length === 0) return false;
  const dateStr = checkDate.toISOString().split("T")[0]; // YYYY-MM-DD
  return holidays.some(
    (holiday) => holiday.date.toISOString().split("T")[0] === dateStr
  );
}

const LOOKAHEAD_DAYS = 3;

async function generateRecurringInstances(
  parentTaskData,
  companyId,
  generateNextOnly = false
) {
  if (
    !parentTaskData.repeat ||
    !parentTaskData.recurrenceActive ||
    !parentTaskData.nextFinishDateTime
  ) {
    return [];
  }

  const companyObjId = new mongoose.Types.ObjectId(companyId);
  const holidays = await getHolidaysForPeriod(
    companyId,
    new Date(),
    new Date(parentTaskData.nextFinishDateTime)
  );

  if (generateNextOnly) {
    // Calculate next instance date after now
    const now = new Date();
    const nextDate = calculateNextInstanceDate(parentTaskData, now);
    if (!nextDate) {
      return [];
    }

    const endDate = new Date(parentTaskData.nextFinishDateTime);
    if (nextDate > endDate) {
      return [];
    }

    // Check if instance already exists
    const startDt = new Date(nextDate);
    startDt.setHours(
      parentTaskData.startDateTime.getHours(),
      parentTaskData.startDateTime.getMinutes(),
      0,
      0
    );

    const existing = await Task.findOne({
      parentTask: parentTaskData._id,
      startDateTime: startDt,
      company: companyObjId,
    });

    if (existing) {
      return [];
    }

    // Create instance
    const instance = await createInstance(
      nextDate,
      parentTaskData,
      parentTaskData._id,
      companyObjId,
      endDate,
      holidays
    );
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
  shiftedDate.setHours(0, 0, 0, 0); // Date-only

  let attempts = 0;
  const maxAttempts = 7; // Prevent infinite loop (e.g., week of holidays)

  while (isHoliday(shiftedDate, holidays) && attempts < maxAttempts) {
    shiftedDate.setDate(shiftedDate.getDate() - 1);
    shiftedDate.setHours(0, 0, 0, 0);
    attempts++;

    // Stop if shifted before minStartDate or into past
    if (shiftedDate < minStartDate) {
      console.warn(
        `Cannot shift ${date.toISOString().split("T")[0]} - before start date`
      );
      return null; // Skip this instance
    }
  }

  if (attempts >= maxAttempts) {
    console.warn(
      `Max shift attempts reached for ${date.toISOString().split("T")[0]}`
    );
    return null; // Skip
  }

  return shiftedDate;
}

// Helper to calculate the NEXT scheduled date (unchanged - future only)
function calculateNextInstanceDate(parentTask, currentDate) {
  const freq = parentTask.repeatFrequency;
  let nextDate = new Date(currentDate);
  nextDate.setHours(0, 0, 0, 0); // Start from today date-only

  // NEW: First, check if TODAY matches the pattern (return today if yes)
  const todayDateOnly = new Date(nextDate);

  if (freq === "daily") {
    // Daily: Today always matches
    return todayDateOnly;
  } else if (freq === "weekly") {
    const daysMap = {
      Sunday: 0,
      Monday: 1,
      Tuesday: 2,
      Wednesday: 3,
      Thursday: 4,
      Friday: 5,
      Saturday: 6,
    };
    const todayDayNum = todayDateOnly.getDay();
    const matchingDays = parentTask.repeatDaysOfWeek.map(
      (dayName) => daysMap[dayName]
    );
    if (matchingDays.includes(todayDayNum)) {
      // Today matches - return today
      return todayDateOnly;
    }
    // Else, calculate next future matching day
    let daysFromNow = 7; // Default to next week
    parentTask.repeatDaysOfWeek.forEach((dayName) => {
      const targetDay = daysMap[dayName];
      const currentDay = nextDate.getDay();
      let diff = (targetDay - currentDay + 7) % 7;
      if (diff === 0) diff = 7; // Next week if today (but since today didn't match, this won't trigger)
      if (diff < daysFromNow) daysFromNow = diff;
    });
    nextDate.setDate(nextDate.getDate() + daysFromNow);
    return nextDate;
  } else if (freq === "monthly") {
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
      for (const dayNum of parentTask.repeatDatesOfMonth.sort(
        (a, b) => a - b
      )) {
        const testDate = new Date(year, month, dayNum);
        if (testDate.getMonth() === month && testDate > nextDate) {
          // > nextDate (future only)
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
async function generateNextInstance(
  parentTaskData,
  companyId,
  holidays,
  endDateTime
) {
  const now = new Date();
  now.setHours(0, 0, 0, 0); // Today date-only

  const dueDate = calculateNextInstanceDate(parentTaskData, now); // Now includes today if matching
  if (!dueDate) {
    return null;
  }

  // NEW: Only generate if dueDate <= today (focus on current/past due; future on next call)
  if (dueDate > now) {
    return null;
  }

  const parentStartDate = new Date(parentTaskData.startDateTime);
  parentStartDate.setHours(0, 0, 0, 0);

  // Shift for holidays if needed (applied to dueDate, e.g., today)
  const workingDate = shiftToPreviousNonHoliday(
    dueDate,
    holidays,
    parentStartDate
  );
  if (!workingDate) {
    return null;
  }

  // Ensure shifted date is still <= today (don't generate future after shift)
  if (workingDate > now) {
    return null;
  }

  // Skip if beyond end or before start
  const endDate = new Date(endDateTime);
  endDate.setHours(23, 59, 59, 999);
  if (workingDate > endDate || workingDate < parentStartDate) {
    return null;
  }

  // Check if instance already exists (date-only match on workingDate)
  const startDt = new Date(workingDate);
  startDt.setHours(
    parentTaskData.startDateTime.getHours(),
    parentTaskData.startDateTime.getMinutes() || 0,
    0,
    0
  );
  const existing = await Task.findOne({
    parentTask: parentTaskData._id,
    startDateTime: startDt,
    company: new mongoose.Types.ObjectId(companyId),
  });
  if (existing) {
    return existing;
  }

  // Validate frequency-specific after shift (e.g., if shifted, check if still matches pattern)
  if (parentTaskData.repeatFrequency === "monthly") {
    const expectedDays = parentTaskData.repeatDatesOfMonth;
    if (!expectedDays.includes(workingDate.getDate())) {
      return null;
    }
  } else if (parentTaskData.repeatFrequency === "weekly") {
    const daysMap = {
      Sunday: 0,
      Monday: 1,
      Tuesday: 2,
      Wednesday: 3,
      Thursday: 4,
      Friday: 5,
      Saturday: 6,
    };
    const workingDayNum = workingDate.getDay();
    const matchingDays = parentTaskData.repeatDaysOfWeek.map(
      (day) => daysMap[day]
    );
    if (!matchingDays.includes(workingDayNum)) {
      return null;
    }
  }
  // Daily: Always valid after shift

  // Create instance for workingDate (today or shifted)
  const endDt = new Date(workingDate);
  endDt.setHours(
    parentTaskData.endDateTime.getHours(),
    parentTaskData.endDateTime.getMinutes(),
    59,
    999
  );

 // Generate taskId BEFORE creating the instance
  const nextSeq = await getNextSequenceValue(companyId, "taskid");
  const instance = new Task({
    taskId: `T${nextSeq}`,  // Now nextSeq is defined
    title: parentTaskData.title,
    description: parentTaskData.description,
    department: parentTaskData.department,
    assignedTo: parentTaskData.assignedTo,
    startDateTime: startDt,
    endDateTime: endDt,
    status: "pending",
    creditPoints: parentTaskData.creditPoints,
    priority: parentTaskData.priority,
    company: parentTaskData.company,
    createdBy: parentTaskData.createdBy,
    images: parentTaskData.images || [],
    audios: parentTaskData.audios || [],
    files: parentTaskData.files || [],
    parentTask: parentTaskData._id,
    isRecurringInstance: true,
    recurrenceActive: parentTaskData.recurrenceActive,
  });
  await instance.save();  // Single save with taskId
  return instance;
}

// UPDATED: createInstance (NEW: Check for holiday and shift to one day before)
async function createInstance(
  instanceDate,
  parentTaskData,
  parentId,
  companyObjId,
  endDateTime,
  holidays
) {
  try {
    let workingDate = new Date(instanceDate);
    workingDate.setHours(0, 0, 0, 0);

    const now = new Date();
    now.setSeconds(0, 0, 0, 0);

    // Skip if instance date is before now (past)
    if (workingDate < now) {
      return null;
    }

    const taskStartDate = new Date(parentTaskData.startDateTime);
    taskStartDate.setHours(0, 0, 0, 0);

    // Recursive shift for holidays and before task start date
    while (isHoliday(workingDate, holidays) || workingDate < taskStartDate) {
      workingDate.setDate(workingDate.getDate() - 1);
      workingDate.setHours(0, 0, 0, 0);

      if (workingDate < now) {
        return null;
      }
    }

    // Set start and end times based on parent task
    const startDt = new Date(workingDate);
    startDt.setHours(
      parentTaskData.startDateTime.getHours(),
      parentTaskData.startDateTime.getMinutes(),
      0,
      0
    );

    const endDt = new Date(workingDate);
    endDt.setHours(
      parentTaskData.endDateTime.getHours(),
      parentTaskData.endDateTime.getMinutes(),
      59,
      999
    );

    if (endDt > endDateTime || startDt > endDateTime) {
      return null;
    }

    // Check for existing instance to prevent duplicates
    const existing = await Task.findOne({
      parentTask: parentId,
      startDateTime: startDt,
      company: companyObjId,
    });
    if (existing) {
      return existing;
    }

    // For monthly recurrence, validate day after shift
    if (parentTaskData.repeatFrequency === "monthly") {
      const expectedDay = workingDate.getDate();
      if (!parentTaskData.repeatDatesOfMonth.includes(expectedDay)) {
        return null;
      }
    }


    const shiftMsg = isHoliday(instanceDate, holidays) ? "shifted " : "";

  const nextSeq = await getNextSequenceValue(companyObjId.toString(), "taskid");
    const instance = new Task({
      taskId: `T${nextSeq}`,  // Set taskId here
      title: parentTaskData.title,
      description: parentTaskData.description,
      department: parentTaskData.department,
      assignedTo: parentTaskData.assignedTo,
      startDateTime: startDt,
      endDateTime: endDt,
      status: "pending",
      creditPoints: parentTaskData.creditPoints,
      priority: parentTaskData.priority,
      company: parentTaskData.company,
      createdBy: parentTaskData.createdBy,
      images: parentTaskData.images || [],
      audios: parentTaskData.audios || [],
      files: parentTaskData.files || [],
      parentTask: parentId,
      isRecurringInstance: true,
      recurrenceActive: parentTaskData.recurrenceActive,
    });
    await instance.save();  // Single save with taskId
    return instance;

  } catch (error) {
    console.error(
      `Error creating instance for ${instanceDate.toISOString()}:`,
      error
    );
    return null;
  }
}

// stopRecurrence (unchanged)
exports.stopRecurrence = async (req, res) => {
  try {
    const { id } = req.params;
    const company = await getCompanyIdFromUser(req.user);
    const task = await Task.findOne({
      _id: id,
      company,
      repeat: true,
      isRecurringInstance: { $ne: true },
    });
    if (!task) {
      return res
        .status(404)
        .json({ message: "Recurring parent task not found" });
    }
    task.recurrenceActive = false;
    await task.save();
    res.json({
      message: "Recurrence stopped. No new instances will be generated.",
      task,
    });
  } catch (error) {
    console.error("Stop recurrence error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// resumeRecurrence (unchanged - generates next only)
exports.resumeRecurrence = async (req, res) => {
  try {
    const { id } = req.params;
    const company = await getCompanyIdFromUser(req.user);
    const task = await Task.findOne({
      _id: id,
      company,
      repeat: true,
      isRecurringInstance: { $ne: true },
    });
    if (!task) {
      return res
        .status(404)
        .json({ message: "Recurring parent task not found" });
    }
    task.recurrenceActive = true;
    await task.save();
    const instances = await generateRecurringInstances(
      task.toObject(),
      company,
      true
    );
    res.json({
      message: "Recurrence resumed. Next instance generated.",
      task,
      newInstances: instances.length,
    });
  } catch (error) {
    console.error("Resume recurrence error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// NEW: Check if a date is a holiday (compares YYYY-MM-DD to avoid time issues)
function isHoliday(checkDate, holidays) {
  const dateStr = checkDate.toISOString().split("T")[0]; // YYYY-MM-DD
  return holidays.some((holiday) => {
    const holidayStr = holiday.date.toISOString().split("T")[0];
    return dateStr === holidayStr;
  });
}

exports.createTask = async (req, res) => {
  try {
    console.log("req.user--", req.user);

    // Parse JSON strings from FormData
    let assignedToArray = [];
    if (req.body.assignedTo) {
      try {
        assignedToArray = JSON.parse(req.body.assignedTo);
      } catch (e) {
        return res.status(400).json({
          message: "Invalid assignedTo format - must be JSON array of IDs",
        });
      }
    }

    let repeatDaysOfWeek = [];
    if (req.body.repeatDaysOfWeek) {
      try {
        repeatDaysOfWeek = JSON.parse(req.body.repeatDaysOfWeek);
      } catch (e) {
        return res.status(400).json({
          message: "Invalid repeatDaysOfWeek format - must be JSON array",
        });
      }
    }

    let repeatDatesOfMonth = [];
    if (req.body.repeatDatesOfMonth) {
      try {
        repeatDatesOfMonth = JSON.parse(req.body.repeatDatesOfMonth);
      } catch (e) {
        return res.status(400).json({
          message:
            "Invalid repeatDatesOfMonth format - must be JSON array of numbers",
        });
      }
    }

    const {
      title,
      description,
      department,
      startDateTime,
      endDateTime,
      repeat,
      creditPoints,
      repeatFrequency,
      priority,
      nextFollowUpDateTime,
      createdBy,
      status,
      company: bodyCompany,
      recurringStartDate,
      recurringEndDate, // NEW: From frontend
    } = req.body;

    const company = req.user.companyId || bodyCompany;

    if (
      !title ||
      !department ||
      assignedToArray.length === 0 ||
      !startDateTime ||
      !endDateTime
    ) {
      return res.status(400).json({
        message:
          "Title, department, assignedTo, startDateTime, and endDateTime are required",
      });
    }

    // Validate assignees exist in company
    const assignee = await Employee.find({
      _id: { $in: assignedToArray },
      company: company.toString(),
    });
    if (assignee.length !== assignedToArray.length) {
      return res.status(400).json({
        message: "One or more assigned users not found in your company",
      });
    }

    // Parse dates
    let actualStartDateTime = new Date(startDateTime);
    let actualEndDateTime = new Date(endDateTime);
    let actualNextFinishDateTime = repeat ? actualEndDateTime : undefined;

    if (recurringStartDate) {
      const recurringStart = new Date(recurringStartDate);
      if (!isNaN(recurringStart.getTime())) {
        actualStartDateTime = recurringStart;
      } else {
        return res
          .status(400)
          .json({ message: "Invalid recurringStartDate format" });
      }
    }
    if (recurringEndDate && repeat) {
      const recurringEnd = new Date(recurringEndDate);
      if (!isNaN(recurringEnd.getTime())) {
        actualNextFinishDateTime = recurringEnd;
      } else {
        return res
          .status(400)
          .json({ message: "Invalid recurringEndDate format" });
      }
    }

    if (actualNextFinishDateTime <= actualStartDateTime) {
      return res.status(400).json({
        message: "endDateTime must be after startDateTime for recurring tasks",
      });
    }

    // Repeat validation (unchanged, but use parsed arrays)
    if (repeat) {
      if (
        !repeatFrequency ||
        !["daily", "weekly", "monthly"].includes(repeatFrequency)
      ) {
        return res.status(400).json({
          message:
            "repeatFrequency must be one of daily, weekly, or monthly when repeat is true",
        });
      }
      if (repeatFrequency === "weekly") {
        if (!Array.isArray(repeatDaysOfWeek) || repeatDaysOfWeek.length === 0) {
          return res.status(400).json({
            message:
              "repeatDaysOfWeek must be a non-empty array when repeatFrequency is weekly",
          });
        }
        repeatDaysOfWeek.forEach((day) => {
          if (!validWeekDays.includes(day)) {
            return res
              .status(400)
              .json({ message: `Invalid day in repeatDaysOfWeek: ${day}` });
          }
        });
      }
      if (repeatFrequency === "monthly") {
        if (
          !Array.isArray(repeatDatesOfMonth) ||
          repeatDatesOfMonth.length === 0
        ) {
          return res.status(400).json({
            message:
              "repeatDatesOfMonth must be a non-empty array when repeatFrequency is monthly",
          });
        }
        repeatDatesOfMonth.forEach((date) => {
          if (typeof date !== "number" || date < 1 || date > 31) {
            return res
              .status(400)
              .json({ message: `Invalid date in repeatDatesOfMonth: ${date}` });
          }
        });
      }
    } else {
      if (!nextFollowUpDateTime) {
        return res.status(400).json({
          message: "nextFollowUpDateTime is required when repeat is false",
        });
      }
    }

    // Files from multer (unchanged)
    const images = req.files?.images ? req.files.images.map((f) => f.path) : [];
    const audios = req.files?.audios ? req.files.audios.map((f) => f.path) : [];
    const files = req.files?.files ? req.files.files.map((f) => f.path) : [];

  
    // Updated: Generate and assign taskId per company after saving
    // if (!task.repeat) {
      const nextSeq = await getNextSequenceValue(company, "taskid");

    const taskData = {
      taskId: `T${nextSeq}`,  // Always set taskId here
      title,
      description,
      department: new mongoose.Types.ObjectId(department),
      assignedTo: assignedToArray,
      startDateTime: actualStartDateTime,
      endDateTime: actualEndDateTime,
      repeat: repeat === "true",
      creditPoints: parseInt(creditPoints) || 0,
      repeatFrequency: repeat ? repeatFrequency : undefined,
      repeatDaysOfWeek: repeat && repeatFrequency === "weekly" ? repeatDaysOfWeek : undefined,
      repeatDatesOfMonth: repeat && repeatFrequency === "monthly" ? repeatDatesOfMonth : undefined,
      priority: priority || "medium",
      nextFollowUpDateTime: !repeat ? new Date(nextFollowUpDateTime) : undefined,
      nextFinishDateTime: actualNextFinishDateTime,
      company: new mongoose.Types.ObjectId(company),
      status: status || "pending",
      createdBy: new mongoose.Types.ObjectId(req.user.id || req.user.userId),
      images,
      audios,
      files,
      isRecurringInstance: false,
      recurrenceActive: repeat ? true : false,
    };
    const task = new Task(taskData);
    await task.save(); 
    // }

    let firstInstance = null;
    if (task.repeat && task.recurrenceActive) {
      const holidays = await getHolidaysForPeriod(
        company,
        actualStartDateTime,
        actualNextFinishDateTime
      );
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startDateOnly = new Date(actualStartDateTime);
      startDateOnly.setHours(0, 0, 0, 0);

      const dueForStart = calculateNextInstanceDate(
        task.toObject(),
        startDateOnly
      );
      if (
        dueForStart &&
        dueForStart.toISOString().split("T")[0] ===
          startDateOnly.toISOString().split("T")[0] &&
        startDateOnly >= today
      ) {
        firstInstance = await generateNextInstance(
          task.toObject(),
          company,
          holidays,
          actualNextFinishDateTime
        );
        if (firstInstance) {
          console.log(
            `✅ First instance generated on create for start date ${
              startDateOnly.toISOString().split("T")[0]
            }: ${firstInstance.startDateTime.toISOString()}`
          );
        } else {
          console.warn(
            `⚠️ Could not generate first instance (holiday shift failed or invalid)`
          );
        }
      } else {
        console.log(
          `Start date ${
            startDateOnly.toISOString().split("T")[0]
          } doesn't match pattern or is in past - first instance will generate on next list call`
        );
      }
    }

    console.log(
      `Task created: ${
        task.repeat ? "Recurring parent" : "One-time task"
      } with ID ${task._id}, repeat: ${task.repeat}`
    );

    // Populate
    await task.populate("assignedTo", "firstName lastName role");
    await task.populate("createdBy", "firstName lastName role");

    res.status(201).json({
      message: "Task created successfully",
      task,
      firstInstance: firstInstance
        ? { ...firstInstance.toObject(), isRecurringInstance: true }
        : null,
    });
  } catch (error) {
    console.error("Create task error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// FIXED: getAllTasks - Now includes parents (no skip); pushes parent first, then instances for recurring
exports.getAllTasks = async (req, res) => {
  try {
    const companyStr = await getCompanyIdFromUser(req.user);
    if (!companyStr) {
      return res
        .status(400)
        .json({ message: "Company ID not found in user data" });
    }

    const companyObjId = new mongoose.Types.ObjectId(companyStr);

    // Base filters (unchanged)
    let filters = {
      company: companyObjId,
      isRecurringInstance: { $ne: true }, // Start with parents/non-recurring
    };

    // Apply other query filters (unchanged)
    if (req.query.assignedTo)
      filters.assignedTo = new mongoose.Types.ObjectId(req.query.assignedTo);
    if (req.query.createdBy)
      filters.createdBy = new mongoose.Types.ObjectId(req.query.createdBy);
    if (req.query.department)
      filters.department = new mongoose.Types.ObjectId(req.query.department);
    if (req.query.priority) filters.priority = req.query.priority;
    if (req.query.repeat !== undefined)
      filters.repeat = req.query.repeat === "true";

    // Recurring filter logic (unchanged)
    const recurringFilter = req.query.recurring;
    if (recurringFilter === "recurring") {
      filters.repeat = true;
      filters.recurrenceActive = true;
    } else if (recurringFilter === "non-recurring") {
      filters.$or = [
        { repeat: { $ne: true } },
        { isRecurringInstance: true },
        { recurrenceActive: false },
      ];
      delete filters.isRecurringInstance;
    } else if (recurringFilter === "all") {
      filters = { company: companyObjId };
      delete filters.isRecurringInstance;
    }

    // FIXED: Aggregation pipeline - Removed invalid $addFields ($$parentTitle undefined); fetches instances cleanly

    // const aggregation = await Task.aggregate([
    //   { $match: filters },
    //   {
    //     $lookup: {
    //       from: "tasks",
    //       let: { parentId: "$_id" },
    //       pipeline: [
    //         {
    //           $match: {
    //             $expr: { $eq: ["$parentTask", "$$parentId"] },
    //             company: companyObjId, // Ensure company match
    //           },
    //         },
    //         // FIXED: No date filter - fetches ALL instances (past + future)
    //         {
    //           $lookup: {
    //             from: "employees",
    //             localField: "assignedTo",
    //             foreignField: "_id",
    //             as: "assignedTo",
    //           },
    //         },
    //         // UPDATED: Conditional lookups for createdBy (employee or company)
    //         {
    //           $lookup: {
    //             from: "employees",
    //             localField: "createdBy",
    //             foreignField: "_id",
    //             as: "createdByEmployee",
    //           },
    //         },
    //         {
    //           $lookup: {
    //             from: "companies",
    //             localField: "createdBy",
    //             foreignField: "_id",
    //             as: "createdByCompany",
    //           },
    //         },
    //         {
    //           $addFields: {
    //             createdBy: {
    //               $cond: {
    //                 if: { $gt: [{ $size: "$createdByEmployee" }, 0] }, // If found in employees
    //                 then: {
    //                   $mergeObjects: [
    //                     { $arrayElemAt: ["$createdByEmployee", 0] },
    //                     { role: "employee" }, // Explicitly set role
    //                   ],
    //                 },
    //                 else: {
    //                   $cond: {
    //                     if: { $gt: [{ $size: "$createdByCompany" }, 0] }, // Else if found in companies
    //                     then: {
    //                       $mergeObjects: [
    //                         { $arrayElemAt: ["$createdByCompany", 0] },
    //                         { role: "company" }, // Explicitly set role
    //                       ],
    //                     },
    //                     else: null, // Fallback to null (frontend shows "Unknown")
    //                   },
    //                 },
    //               },
    //             },
    //           },
    //         },
    //         // Clean up temporary fields
    //         {
    //           $project: {
    //             createdByEmployee: 0,
    //             createdByCompany: 0,
    //           },
    //         },
    //       ],
    //       as: "recurringInstances",
    //     },
    //   },
    //   // UPDATED: Conditional lookups for createdBy in main pipeline (for parents/non-recurring)
    //   {
    //     $lookup: {
    //       from: "employees",
    //       localField: "createdBy",
    //       foreignField: "_id",
    //       as: "createdByEmployee",
    //     },
    //   },
    //   {
    //     $lookup: {
    //       from: "companies",
    //       localField: "createdBy",
    //       foreignField: "_id",
    //       as: "createdByCompany",
    //     },
    //   },
    //   {
    //     $addFields: {
    //       createdBy: {
    //         $cond: {
    //           if: { $gt: [{ $size: "$createdByEmployee" }, 0] },
    //           then: {
    //             $mergeObjects: [
    //               { $arrayElemAt: ["$createdByEmployee", 0] },
    //               { role: "employee" },
    //             ],
    //           },
    //           else: {
    //             $cond: {
    //               if: { $gt: [{ $size: "$createdByCompany" }, 0] },
    //               then: {
    //                 $mergeObjects: [
    //                   { $arrayElemAt: ["$createdByCompany", 0] },
    //                   { role: "company" },
    //                 ],
    //               },
    //               else: null,
    //             },
    //           },
    //         },
    //       },
    //     },
    //   },
    //   // Clean up temporary fields
    //   {
    //     $project: {
    //       createdByEmployee: 0,
    //       createdByCompany: 0,
    //     },
    //   },
    //   // Compute overdue (unchanged)
    //   {
    //     $addFields: {
    //       isOverdue: {
    //         $and: [
    //           { $lt: ["$endDateTime", new Date()] },
    //           { $ne: ["$status", "completed"] },
    //           {
    //             $or: [
    //               { $eq: ["$repeatFrequency", "daily"] },
    //               { $eq: ["$repeat", false] },
    //             ],
    //           },
    //         ],
    //       },
    //     },
    //   },
    //   { $sort: { createdAt: -1 } },
    // ]);
    const aggregation = await Task.aggregate([
      { $match: filters },
      {
        $lookup: {
          from: "tasks",
          let: { parentId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$parentTask", "$$parentId"] },
                company: companyObjId, // Ensure company match
              },
            },
            // FIXED: No date filter - fetches ALL instances (past + future)
            {
              $lookup: {
                from: "employees",
                localField: "assignedTo",
                foreignField: "_id",
                as: "assignedTo",
              },
            },
            {
              $lookup: {
                from: "employees",
                localField: "createdBy",
                foreignField: "_id",
                as: "createdBy",
              },
            },
            // REMOVED: $addFields { parentTitle: '$$parentTitle' } - Not needed; add in JS loop
          ],
          as: "recurringInstances",
        },
      },
      // Compute overdue (unchanged)
      {
        $addFields: {
          isOverdue: {
            $and: [
              { $lt: ["$endDateTime", new Date()] },
              { $ne: ["$status", "completed"] },
              {
                $or: [
                  { $eq: ["$repeatFrequency", "daily"] },
                  { $eq: ["$repeat", false] },
                ],
              },
            ],
          },
        },
      },
      { $sort: { createdAt: -1 } },
    ]);

    // UPDATED: Build flat list - ALWAYS push parents (no skip); for recurring, additionally push instances + generate next
    const allTasks = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Today date-only
    const instanceIds = new Set(); // Track instance IDs to avoid duplicates

    for (const doc of aggregation) {
      const isRecurringParent =
        doc.repeat && doc.recurrenceActive && !doc.isRecurringInstance;

      // ALWAYS push the parent/doc first (for visibility/management, e.g., resume button)
      allTasks.push({
        ...doc,
        isRecurringInstance: false,
        isOverdue:
          doc.isOverdue ||
          (doc.endDateTime < new Date() && doc.status !== "completed"), // Ensure overdue for parents
      });

      // For recurring parents: Additionally push instances + generate next (if active)
      if (isRecurringParent) {
        // Add existing instances (deduplicated)
        const existingInstances = doc.recurringInstances || [];
        existingInstances.forEach((child) => {
          if (!instanceIds.has(child._id.toString())) {
            instanceIds.add(child._id.toString());
            allTasks.push({
              ...child,
              isRecurringInstance: true,
              parentTitle: doc.title, // Add parent title to each instance
              isOverdue:
                child.endDateTime < new Date() && child.status !== "completed",
              newlyGenerated: false, // Existing, not new
            });
          }
        });

        // Generate/add next due instance if recurring and active (prioritizes today if matching)
        if (doc.nextFinishDateTime) {
          const holidays = await getHolidaysForPeriod(
            companyStr,
            doc.startDateTime,
            doc.nextFinishDateTime
          );
          const currentInstance = await generateNextInstance(
            doc,
            companyStr,
            holidays,
            doc.nextFinishDateTime
          );
          if (
            currentInstance &&
            !instanceIds.has(currentInstance._id.toString())
          ) {
            instanceIds.add(currentInstance._id.toString());
            allTasks.push({
              ...currentInstance.toObject(),
              isRecurringInstance: true,
              parentTitle: doc.title,
              isOverdue: false, // New instances are not overdue
              newlyGenerated: true, // Flag for frontend
            });
          }
        }
      } else {
      }
    }

    // Final sort: By startDateTime descending (recent/past first, then future); fallback to createdAt for parents
    allTasks.sort((a, b) => {
      const aDate = a.isRecurringInstance
        ? new Date(a.startDateTime)
        : new Date(a.createdAt || a.endDateTime);
      const bDate = b.isRecurringInstance
        ? new Date(b.startDateTime)
        : new Date(b.createdAt || b.endDateTime);
      return bDate - aDate;
    });

    // Remove embedded recurringInstances from final docs (not needed in flat list)
    const cleanTasks = allTasks.map((task) => {
      const { recurringInstances, ...cleanTask } = task;
      return cleanTask;
    });

    res.json({ tasks: cleanTasks });
  } catch (error) {
    console.error("Get all tasks error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// UPDATED: getTaskById (fetch ALL instances for parent, including past)
exports.getTaskById = async (req, res) => {
  try {
    const { id } = req.params;
    const company = await getCompanyIdFromUser(req.user);
    let task = await Task.findOne({ _id: id, company })
      .populate("assignedTo", "firstName role")
      .populate("createdBy", "firstName role");
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // UPDATED: Fetch ALL instances (past + future) if parent
    let recurringInstances = [];
    if (task.repeat) {
      recurringInstances = await Task.find({ parentTask: id, company })
        .populate("assignedTo", "firstName role")
        .populate("createdBy", "firstName role")
        .sort({ startDateTime: 1 });

      // Generate current due instance if missing and matching (<= today)
      if (task.recurrenceActive && task.nextFinishDateTime) {
        const holidays = await getHolidaysForPeriod(
          company,
          task.startDateTime,
          task.nextFinishDateTime
        );
        const currentInstance = await generateNextInstance(
          task.toObject(),
          company,
          holidays,
          task.nextFinishDateTime
        );
        if (currentInstance) {
          recurringInstances.push({
            ...currentInstance.toObject(),
            isRecurringInstance: true,
            parentTitle: task.title,
            isOverdue: false,
            newlyGenerated: true, // Optional flag
          });
          recurringInstances.sort(
            (a, b) => new Date(a.startDateTime) - new Date(b.startDateTime)
          );
        }
      }
    }

    // Compute overdue for main task
    const taskWithOverdue = {
      ...task.toObject(),
      isOverdue: task.endDateTime < new Date() && task.status !== "completed",
    };
    res.json({
      task: taskWithOverdue,
      recurringInstances, // All instances (past + future + newly generated current due)
    });
  } catch (error) {
    console.error("Get task by ID error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// UPDATED: updateTask - Parse JSON from FormData; merge existing + new files; handle recurring dates
exports.updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    // Fetch existing task
    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }
    // Parse JSON strings from FormData (handle empty strings safely)
    const parseJsonSafe = (str, fallback = []) => {
      try {
        return JSON.parse(str || JSON.stringify(fallback));
      } catch (error) {
        console.error("❌ JSON parse error:", error);
        return fallback;
      }
    };
    // Basic fields
    const assignedTo = parseJsonSafe(req.body.assignedTo, []);
    const existingImages = parseJsonSafe(req.body.existingImages, []);
    const existingAudios = parseJsonSafe(req.body.existingAudios, []);
    const existingFiles = parseJsonSafe(req.body.existingFiles, []);
    // Removed attachments (for deletions)
    const removedImages = parseJsonSafe(req.body.removedImages, []);
    const removedAudios = parseJsonSafe(req.body.removedAudios, []);
    const removedFiles = parseJsonSafe(req.body.removedFiles, []);
    // Other fields
    const title = req.body.title?.trim() || task.title;
    const description = req.body.description?.trim() || task.description;
    const department = req.body.department?.trim() || task.department;
    const priority =
      req.body.priority?.toLowerCase() ||
      task.priority?.toLowerCase() ||
      "medium";
    const status = req.body.status?.toLowerCase() || task.status || "pending";
    const creditPoints =
      parseInt(req.body.creditPoints) || task.creditPoints || 0;
    // Date fields (parse ISO strings safely)
    const startDateTime = req.body.startDateTime
      ? new Date(req.body.startDateTime)
      : task.startDateTime;
    const endDateTime = req.body.endDateTime
      ? new Date(req.body.endDateTime)
      : task.endDateTime;
    const nextFollowUpDateTime = req.body.nextFollowUpDateTime
      ? new Date(req.body.nextFollowUpDateTime)
      : task.nextFollowUpDateTime;
    // Validate dates
    if (startDateTime && isNaN(startDateTime.getTime())) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid start date" });
    }
    if (endDateTime && isNaN(endDateTime.getTime())) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid end date" });
    }
    if (nextFollowUpDateTime && isNaN(nextFollowUpDateTime.getTime())) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid next follow-up date" });
    }
    // Repeat/recurring fields
    const repeat = req.body.repeat === "true" || req.body.repeat === true;
    const repeatFrequency =
      req.body.repeatFrequency || task.repeatFrequency || "daily";
    const repeatDaysOfWeek = parseJsonSafe(
      req.body.repeatDaysOfWeek,
      task.repeatDaysOfWeek || []
    );
    const repeatDatesOfMonth = parseJsonSafe(
      req.body.repeatDatesOfMonth,
      task.repeatDatesOfMonth || []
    );
    const recurringStartDate = req.body.recurringStartDate
      ? new Date(req.body.recurringStartDate)
      : task.recurringStartDate;
    const recurringEndDate = req.body.recurringEndDate
      ? new Date(req.body.recurringEndDate)
      : task.recurringEndDate;
    const nextFinishDateTime = req.body.nextFinishDateTime
      ? new Date(req.body.nextFinishDateTime)
      : task.nextFinishDateTime;
    // Validate recurring dates if repeat is enabled
    if (repeat) {
      if (recurringStartDate && isNaN(recurringStartDate.getTime())) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid recurring start date" });
      }
      if (recurringEndDate && isNaN(recurringEndDate.getTime())) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid recurring end date" });
      }
      if (
        recurringStartDate &&
        recurringEndDate &&
        recurringEndDate <= recurringStartDate
      ) {
        return res.status(400).json({
          success: false,
          message: "Recurring end date must be after start date",
        });
      }
    }
    // Company and createdBy (preserve or set if needed)
    const company = req.body.company || task.company;
    const createdBy = task.createdBy; // Preserve original creator
    // UPDATED: Handle attachments – Filter removals, merge existing + new
    // Images
    let currentImages = task.images || [];
    currentImages = currentImages.filter((url) => !removedImages.includes(url)); // Remove deleted
    currentImages = [...new Set([...currentImages, ...existingImages])]; // Merge remaining existing (dedupe)
    if (req.files?.images && Array.isArray(req.files.images)) {
      const newImageUrls = req.files.images
        .map((file) => file.path || file.secure_url)
        .filter(Boolean);
      currentImages = [...currentImages, ...newImageUrls];
    }
    task.images = currentImages;
    // Audios
    let currentAudios = task.audios || [];
    currentAudios = currentAudios.filter((url) => !removedAudios.includes(url));
    currentAudios = [...new Set([...currentAudios, ...existingAudios])];
    if (req.files?.audios && Array.isArray(req.files.audios)) {
      const newAudioUrls = req.files.audios
        .map((file) => file.path || file.secure_url)
        .filter(Boolean);
      currentAudios = [...currentAudios, ...newAudioUrls];
    }
    task.audios = currentAudios;
    // Files
    let currentFiles = task.files || [];
    currentFiles = currentFiles.filter((url) => !removedFiles.includes(url));
    currentFiles = [...new Set([...currentFiles, ...existingFiles])];
    if (req.files?.files && Array.isArray(req.files.files)) {
      const newFileUrls = req.files.files
        .map((file) => file.path || file.secure_url)
        .filter(Boolean);
      currentFiles = [...currentFiles, ...newFileUrls];
    }
    task.files = currentFiles;
    // OPTIONAL: Delete removed files from Cloudinary (uncomment if needed)
    /*
    const deleteFromCloudinary = async (urls, resourceType = 'image') => {
      for (const url of urls) {
        try {
          const publicId = cloudinary.utils.extractPublicId(url);
          if (publicId) {
            await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
            console.log(`🗑️ Deleted from Cloudinary: ${publicId} (${resourceType})`);
          }
        } catch (delError) {
          console.error(`❌ Cloudinary delete failed for ${url}:`, delError);
        }
      }
    };
    // Delete removed files
    await deleteFromCloudinary(removedImages, 'image');
    await deleteFromCloudinary(removedAudios, 'video');  // Or 'raw' for audio
    await deleteFromCloudinary(removedFiles, 'raw');  // Adjust resource_type as per your setup
    */
    // Update task fields
    task.title = title;
    task.description = description;
    task.assignedTo = assignedTo; // Array of employee IDs
    task.department = department; // Department ID
    task.priority = priority;
    task.status = status;
    task.creditPoints = creditPoints;
    // Dates
    if (startDateTime) task.startDateTime = startDateTime;
    if (endDateTime) task.endDateTime = endDateTime;
    if (nextFollowUpDateTime) task.nextFollowUpDateTime = nextFollowUpDateTime;
    // Repeat/recurring
    task.repeat = repeat;
    if (repeat) {
      task.repeatFrequency = repeatFrequency;
      task.repeatDaysOfWeek = repeatDaysOfWeek;
      task.repeatDatesOfMonth = repeatDatesOfMonth;
      if (recurringStartDate) task.recurringStartDate = recurringStartDate;
      if (recurringEndDate) task.recurringEndDate = recurringEndDate;
      if (nextFinishDateTime) task.nextFinishDateTime = nextFinishDateTime;
    }
    // Preserve other fields
    task.company = company;
    task.createdBy = createdBy;
    task.updatedAt = new Date();
    // Validate required fields
    if (!title.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Title is required" });
    }
    if (!assignedTo.length) {
      return res
        .status(400)
        .json({ success: false, message: "At least one assignee is required" });
    }
    if (!department) {
      return res
        .status(400)
        .json({ success: false, message: "Department is required" });
    }
    // Save updated task
    const updatedTask = await task.save();
    // Ensure attachment fields are arrays in response (even if empty)
    updatedTask.images = updatedTask.images || [];
    updatedTask.audios = updatedTask.audios || [];
    updatedTask.files = updatedTask.files || [];

    res.status(200).json({
      success: true,
      message: "Task updated successfully",
      task: updatedTask, // Full task with attachments
    });
  } catch (error) {
    console.error("❌ Update task error:", error);

    // Handle specific errors (e.g., validation, DB)
    let statusCode = 500;
    let message = "Failed to update task";

    if (error.name === "ValidationError") {
      statusCode = 400;
      message =
        "Validation error: " +
        Object.values(error.errors)
          .map((e) => e.message)
          .join(", ");
    } else if (error.message.includes("required")) {
      statusCode = 400;
      message = error.message;
    }
    res.status(statusCode).json({
      success: false,
      message: message,
      error: error.message, // For debugging; remove in production
    });
  }
};

// UPDATED: deleteTask - Deletes parent + all instances (past + future) if recurring
exports.deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    const company = await getCompanyIdFromUser(req.user);
    const deleteSeries = req.query.deleteSeries === "true";

    if (deleteSeries) {
      const parentTask = await Task.findOne({
        _id: id,
        company,
        repeat: true,
        isRecurringInstance: { $ne: true },
      });
      if (!parentTask) {
        return res.status(404).json({
          message: "Recurring parent task not found for series deletion",
        });
      }
      // Delete all children (past + future instances)
      const deletedInstances = await Task.deleteMany({ parentTask: id });
      // Delete parent
      await Task.findByIdAndDelete(id);
      res.json({
        message: `Entire recurring series deleted successfully (parent + ${deletedInstances.deletedCount} instances)`,
        deletedInstancesCount: deletedInstances.deletedCount,
      });
    } else {
      // Single task deletion (or child instance)
      const task = await Task.findOneAndDelete({ _id: id, company });
      if (!task) {
        return res
          .status(404)
          .json({ message: "Task not found or not authorized" });
      }
      let deletedInstancesCount = 0;
      // If deleting a parent without series flag, still delete all children (safety)
      if (task.repeat) {
        const deletedInstances = await Task.deleteMany({ parentTask: id });
        deletedInstancesCount = deletedInstances.deletedCount;
      }
      res.json({
        message: "Task deleted successfully",
        deletedInstancesCount, // 0 if non-recurring/single
      });
    }
  } catch (error) {
    console.error("Delete task error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// UPDATED: shiftedTask - Now handles date updates (startDateTime, endDateTime) with validation
exports.shiftedTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const {
      assignedTo,
      description: providedDescription,
      nextFollowUp,
      startDateTime: newStartDateTime, // NEW: From frontend payload
      endDateTime: newEndDateTime, // NEW: From frontend payload
    } = req.body;
    const shiftedBy = req.user.id || req.user.userId; // from auth middleware
    console.log("req.body (shiftedTask):", req.body);

    if (!assignedTo) {
      return res
        .status(400)
        .json({ message: "New assignee ID(s) is required" });
    }

    // NEW: Validate and parse new dates if provided
    let validatedStartDateTime = null;
    let validatedEndDateTime = null;
    let dateChangeDescription = "";

    if (newStartDateTime || newEndDateTime) {
      // Parse dates
      if (newStartDateTime) {
        validatedStartDateTime = new Date(newStartDateTime);
        if (isNaN(validatedStartDateTime)) {
          return res
            .status(400)
            .json({ message: "Invalid startDateTime format" });
        }
      }
      if (newEndDateTime) {
        validatedEndDateTime = new Date(newEndDateTime);
        if (isNaN(validatedEndDateTime)) {
          return res
            .status(400)
            .json({ message: "Invalid endDateTime format" });
        }
      }

      // Ensure end > start
      if (
        validatedStartDateTime &&
        validatedEndDateTime &&
        validatedEndDateTime <= validatedStartDateTime
      ) {
        return res
          .status(400)
          .json({ message: "endDateTime must be after startDateTime" });
      }

      // Prevent past dates (unless updating an existing overdue instance)
      const now = new Date();
      if (validatedStartDateTime && validatedStartDateTime < now) {
        return res
          .status(400)
          .json({ message: "Start date cannot be in the past" });
      }
      if (validatedEndDateTime && validatedEndDateTime < now) {
        return res
          .status(400)
          .json({ message: "End date cannot be in the past" });
      }

      // For recurring parents: Restrict core date changes to avoid breaking pattern
      // (Allow for instances or non-recurring)
      dateChangeDescription = validatedStartDateTime
        ? `, start changed to ${validatedStartDateTime.toISOString()}`
        : "";
      dateChangeDescription += validatedEndDateTime
        ? `, end changed to ${validatedEndDateTime.toISOString()}`
        : "";
    }

    // Find the task (works for parent or instance)
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // NEW: For recurring parents, prevent changing startDateTime if it affects recurrence pattern
    if (task.repeat && !task.isRecurringInstance && newStartDateTime) {
      // Check if new start changes the day/date that matches frequency
      const originalStartDay = new Date(task.startDateTime).getDate();
      const newStartDay = validatedStartDateTime.getDate();
      if (
        task.repeatFrequency === "monthly" &&
        task.repeatDatesOfMonth &&
        !task.repeatDatesOfMonth.includes(newStartDay)
      ) {
        return res.status(400).json({
          message:
            "Cannot change start date on recurring parent - it would break the monthly pattern. Update instances instead.",
        });
      }
      // Similar checks for weekly/daily can be added if needed
    }

    // Normalize assignedTo and oldAssigneeId as arrays
    const oldAssigneeIds = Array.isArray(task.assignedTo)
      ? task.assignedTo
      : [task.assignedTo];
    const newAssignedToArray = Array.isArray(assignedTo)
      ? assignedTo
      : [assignedTo];

    // Apply updates
    task.assignedTo = newAssignedToArray;

    if (nextFollowUp) {
      const nextFollowUpDate = new Date(nextFollowUp);
      if (isNaN(nextFollowUpDate)) {
        return res.status(400).json({ message: "Invalid nextFollowUp date" });
      }
      task.nextFollowUpDateTime = nextFollowUpDate;
    }

    // NEW: Apply date updates if provided
    if (validatedStartDateTime) {
      task.startDateTime = validatedStartDateTime;
    }
    if (validatedEndDateTime) {
      task.endDateTime = validatedEndDateTime;
      // For recurring parents, also update nextFinishDateTime if endDateTime changed
      if (task.repeat && !task.isRecurringInstance) {
        task.nextFinishDateTime = validatedEndDateTime;
      }
    }

    await task.save();

    // UPDATED: Create status update entry with date change info
    const fullDescription =
      providedDescription ||
      `Task reassigned from ${oldAssigneeIds.join(
        ", "
      )} to ${newAssignedToArray.join(", ")}${dateChangeDescription}`;

    const statusUpdate = new TaskStatusUpdate({
      task: taskId,
      status: "reassigned",
      description: fullDescription,
      nextFollowUpDateTime: nextFollowUp ? new Date(nextFollowUp) : undefined,
      shiftedBy,
      oldAssigneeId:
        oldAssigneeIds.length === 1 ? oldAssigneeIds[0] : oldAssigneeIds,
      assignedTo:
        newAssignedToArray.length === 1
          ? newAssignedToArray[0]
          : newAssignedToArray,
    });

    await statusUpdate.save();

    // NEW: If recurring instance was updated, flag for potential regeneration (but don't auto-regen here)
    if (
      task.isRecurringInstance &&
      (validatedStartDateTime || validatedEndDateTime)
    ) {
      console.log(
        `Date updated on recurring instance ${taskId} - future generations unaffected`
      );
    }

    res.json({
      message:
        "Task reassigned successfully" +
        (dateChangeDescription ? " with updated dates" : ""),
      task,
      statusUpdate,
    });
  } catch (error) {
    console.error("Reassign task error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// getTasksByEmployeeId (unchanged - fetches all tasks assigned to employee, including instances)
exports.getTasksByEmployeeId = async (req, res) => {
  try {
    const { employeeId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({ message: "Invalid employee ID" });
    }

    const tasks = await Task.find({ assignedTo: employeeId })
      .populate("assignedTo", "firstName lastName role")
      .populate("createdBy", "firstName lastName role")
      .populate("department", "name") // adjust fields as per your schema
      .sort({ createdAt: -1 });

    res.json({ tasks });
  } catch (error) {
    console.error("Get tasks by employee ID error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get credit points task-wise (unchanged - includes all tasks/instances)
exports.getCreditPointsTaskWise = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser(req.user);

    // Find tasks for company, select creditPoints and assignedTo
    const tasks = await Task.find({
      company: new mongoose.Types.ObjectId(company),
    }) // FIXED: Cast to ObjectId
      .select("title creditPoints assignedTo")
      .populate("assignedTo", "firstName lastName role");

    // Format response: each task with creditPoints and assigned employees
    const result = tasks.map((task) => ({
      taskId: task._id,
      title: task.title,
      creditPointsPerEmployee: task.creditPoints || 0,
      assignedEmployees: task.assignedTo.map((emp) => ({
        employeeId: emp._id,
        name: `${emp.firstName} ${emp.lastName}`,
        role: emp.role,
        creditPoints: task.creditPoints || 0, // each assigned employee gets full creditPoints
      })),
    }));

    res.json({ tasks: result });
  } catch (error) {
    console.error("Get credit points task-wise error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get credit points employee-wise (unchanged - sums across all tasks/instances)
exports.getCreditPointsEmployeeWise = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser(req.user);

    // Aggregate tasks grouped by assignedTo employees
    // Since assignedTo is an array, unwind it first
    const aggregation = await Task.aggregate([
      { $match: { company: new mongoose.Types.ObjectId(company) } },
      { $unwind: "$assignedTo" },
      {
        $group: {
          _id: "$assignedTo",
          totalCreditPoints: { $sum: "$creditPoints" },
        },
      },
      {
        $lookup: {
          from: "employees",
          localField: "_id",
          foreignField: "_id",
          as: "employee",
        },
      },
      { $unwind: "$employee" },
      {
        $project: {
          _id: 0,
          employeeId: "$_id",
          name: { $concat: ["$employee.firstName", " ", "$employee.lastName"] },
          role: "$employee.role",
          totalCreditPoints: 1,
        },
      },
      { $sort: { totalCreditPoints: -1 } },
    ]);

    res.json({ employees: aggregation });
  } catch (error) {
    console.error("Get credit points employee-wise error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
