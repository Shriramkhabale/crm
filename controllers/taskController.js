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

async function generateRecurringInstances(parentTaskData, companyId) {
  if (!parentTaskData.repeat || !parentTaskData.nextFinishDateTime) return [];
  const instances = [];
  let currentDate = new Date(parentTaskData.startDateTime);
  const endDateTime = new Date(parentTaskData.nextFinishDateTime);
  const parentId = parentTaskData._id;
 // Helper to create instance
  const createInstance = async (instanceDate) => {
    const startDt = new Date(instanceDate);
    startDt.setHours(parentTaskData.startDateTime.getHours(), parentTaskData.startDateTime.getMinutes(), 0, 0);
    const endDt = new Date(instanceDate);
    endDt.setHours(parentTaskData.endDateTime.getHours(), parentTaskData.endDateTime.getMinutes(), 59, 999);
    if (endDt > endDateTime) return null;  // Beyond end
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
    });
    await instance.save();
    return instance;
  };
 while (currentDate <= endDateTime) {
    let instanceDate = new Date(currentDate);
    if (parentTaskData.repeatFrequency === 'daily') {
      // Daily: Every day
      const instance = await createInstance(instanceDate);
      if (instance) instances.push(instance);
      currentDate.setDate(currentDate.getDate() + 1);
    } else if (parentTaskData.repeatFrequency === 'weekly') {
      // Weekly: Only on selected days
      const currentDayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
      if (parentTaskData.repeatDaysOfWeek.includes(currentDayName)) {
        const instance = await createInstance(instanceDate);
        if (instance) instances.push(instance);
      }
      currentDate.setDate(currentDate.getDate() + 1);  // Advance day-by-day to check
    } else if (parentTaskData.repeatFrequency === 'monthly') {
      // Monthly: On selected dates each month
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      for (const dayNum of parentTaskData.repeatDatesOfMonth) {
        const instanceDate = new Date(year, month, dayNum);
        if (isNaN(instanceDate.getTime())) continue;  // Invalid date (e.g., 31 in Feb)
        const instance = await createInstance(instanceDate);
        if (instance) instances.push(instance);
      }

       currentDate.setMonth(currentDate.getMonth() + 1);
      if (currentDate.getDate() !== 1) currentDate.setDate(1);  // Ensure start of month
    }
  }
  return instances;
}

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
    // Repeat validation (enhanced for multi-select)
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
    };
    const task = new Task(taskData);
    await task.save();
    let instances = [];
    if (repeat) {
      // NEW: Generate child instances
      instances = await generateRecurringInstances(taskData, company);
      console.log(`Generated ${instances.length} recurring instances for task ${task._id}`);
    }
    // Populate
    await task.populate('assignedTo', 'firstName lastName role');
    await task.populate('createdBy', 'firstName lastName role');
    res.status(201).json({ 
      message: 'Task created successfully', 
      task, 
      recurringInstances: instances.map(inst => inst.toJSON())  // Return children in response
    });
  } catch (error) {
 console.error('Create task error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// Updated getAllTasks to include children and overdue
exports.getAllTasks = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser  (req.user);
    if (!company) {
      return res.status(400).json({ message: 'Company ID not found in user data' });
    }
    const filters = { company, isRecurringInstance: { $ne: true } };  // Fetch parent tasks only
    if (req.query.assignedTo) filters.assignedTo = req.query.assignedTo;
    if (req.query.createdBy) filters.createdBy = req.query.createdBy;
    if (req.query.department) filters.department = req.query.department;
    if (req.query.priority) filters.priority = req.query.priority;
    if (req.query.repeat) filters.repeat = req.query.repeat === 'true';
    console.log("filters", filters);
    let parentTasks = await Task.find(filters)
      .populate('assignedTo', 'firstName role')
      .populate('createdBy', 'firstName role')
      .sort({ createdAt: -1 });
    // NEW: Flatten with children and compute overdue for all
    const allTasks = [];
    const oneDayMs = 24 * 60 * 60 * 1000;  // 1 day in ms for overdue
    for (const parent of parentTasks) {
      // Add parent (overdue virtual already computed)
      const parentWithOverdue = { ...parent.toObject(), isOverdue: parent.isOverdue };
      allTasks.push(parentWithOverdue);
 // Fetch and add children if repeating
      if (parent.repeat) {
        const children = await Task.find({ parentTask: parent._id })
          .populate('assignedTo', 'firstName role')
          .populate('createdBy', 'firstName role')
          .sort({ startDateTime: 1 });
        children.forEach(child => {
          // Compute overdue for child (daily logic: >1 day past endDateTime and not completed)
          const childOverdue = child.endDateTime < new Date(Date.now() - oneDayMs) && child.status !== 'completed';
          allTasks.push({
            ...child.toObject(),
            isOverdue: childOverdue,
            isRecurringInstance: true,  // Flag for UI
            parentTitle: parent.title,  // Reference to parent
          });
        });
      }
    }
    // Sort all by startDateTime or createdAt
    allTasks.sort((a, b) => new Date(b.startDateTime || b.createdAt) - new Date(a.startDateTime || a.createdAt));
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
console.log("updateData",updateData);

    // Validate repeat fields if updated
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

    // Validate assignedTo if updated
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
    // Apply updates (existing)
    const updatedTaskData = { ...existingTask.toObject(), ...updateData, updatedAt: new Date() };
    const task = await Task.findByIdAndUpdate(id, updatedTaskData, { new: true, runValidators: true });
    // Delete old children if repeat changed or settings updated
    if (updatedTaskData.repeat) {
      await Task.deleteMany({ parentTask: id });  // Clear old instances
      const instances = await generateRecurringInstances(updatedTaskData, company);
      console.log(`Regenerated ${instances.length} recurring instances for updated task ${id}`);
    }
    // Populate
    await task.populate('assignedTo', 'firstName lastName role');
    await task.populate('createdBy', 'firstName lastName role');
    res.json({ message: 'Task updated successfully', task });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};



// Updated deleteTask to delete children
exports.deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    const company = await getCompanyIdFromUser  (req.user);
    // NEW: Delete children first
    await Task.deleteMany({ parentTask: id });
    const task = await Task.findOneAndDelete({ _id: id, company });
    if (!task) {
      return res.status(404).json({ message: 'Task not found or not authorized' });
    }
    res.json({ message: 'Task and recurring instances deleted successfully' });
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