// controller/taskController.js

const Task = require('../models/Task');
const Employee = require('../models/Employee');
const TaskStatusUpdate = require('../models/TaskStatusUpdate');
const mongoose = require('mongoose');

async function getCompanyIdFromUser (user) {
  if (user.role === 'company') {
    return user.userId; // userId is companyId
  } else{
    // Find employee by userId and get companyId
    const employee = await Employee.findById(user.userId).select('company');
    if (!employee) throw new Error('Employee not found');
    return employee.company.toString();
  } 
}
const validWeekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

exports.createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      department,
      assignedTo,
      startDateTime,
      endDateTime,
      repeat,
      creditPoints,
      repeatFrequency,
      repeatDaysOfWeek,
      repeatDatesOfMonth,
      priority,
      nextFollowUpDateTime,
      nextFinishDateTime,
      createdBy,
      status,
      company: bodyCompany
    } = req.body;


    // const createdBy = req.user.userId; // from auth middleware
    const company = req.user.companyId || bodyCompany; // from auth middleware


    // Basic required fields
    if (!title || !department || !assignedTo || !startDateTime || !endDateTime) {
      return res.status(400).json({ message: 'Title, department, assignedTo, startDateTime, and endDateTime are required' });
    }

console.log("company",company);
console.log("assignedTo",assignedTo);
console.log("Employee",Employee);

  // Validate assignedTo user exists and belongs to same company
// const assignee = await Employee.findOne({ _id: assignedTo, company: companyStr });


const assignedToArray = Array.isArray(assignedTo) ? assignedTo : [assignedTo];
const assignee = await Employee.find({ _id: { $in: assignedToArray }, company: company.toString() });
if (assignee.length !== assignedToArray.length) {
  return res.status(400).json({ message: 'One or more assigned users not found in your company' });
}



// const assignee = await Employee.findOne({ _id: assignedTo, company: company.toString() });




    // Validate repeat fields
    if (repeat) {
      if (!repeatFrequency || !['daily', 'weekly', 'monthly'].includes(repeatFrequency)) {
        return res.status(400).json({ message: 'repeatFrequency must be one of daily, weekly, or monthly when repeat is true' });
      }

      if (repeatFrequency === 'weekly') {
        if (!Array.isArray(repeatDaysOfWeek) || repeatDaysOfWeek.length === 0) {
          return res.status(400).json({ message: 'repeatDaysOfWeek must be a non-empty array when repeatFrequency is weekly' });
        }
        // Validate weekdays
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
        // Validate dates 1-31
        for (const date of repeatDatesOfMonth) {
          if (typeof date !== 'number' || date < 1 || date > 31) {
            return res.status(400).json({ message: `Invalid date in repeatDatesOfMonth: ${date}` });
          }
        }
      }

      if (!nextFinishDateTime) {
        return res.status(400).json({ message: 'nextFinishDateTime is required when repeat is true' });
      }
    } else {
      // repeat is false
      if (!nextFollowUpDateTime) {
        return res.status(400).json({ message: 'nextFollowUpDateTime is required when repeat is false' });
      }
    }

    
  // Extract uploaded file URLs from req.files
    const images = req.files['images'] ? req.files['images'].map(file => file.path) : [];
    const audios = req.files['audios'] ? req.files['audios'].map(file => file.path) : [];
    const files = req.files['files'] ? req.files['files'].map(file => file.path) : [];

    // Create task document
    const task = new Task({
      title,
      description,
      department,
      assignedTo: assignedToArray,
      startDateTime,
      endDateTime,
      repeat,
      creditPoints,
      repeatFrequency: repeat ? repeatFrequency : undefined,
      repeatDaysOfWeek: repeat && repeatFrequency === 'weekly' ? repeatDaysOfWeek : undefined,
      repeatDatesOfMonth: repeat && repeatFrequency === 'monthly' ? repeatDatesOfMonth : undefined,
      priority: priority || 'medium',
      nextFollowUpDateTime: !repeat ? nextFollowUpDateTime : undefined,
      nextFinishDateTime: repeat ? nextFinishDateTime : undefined,
      company,
      status,
      createdBy,
      images,
      audios,
      files,
    });

    await task.save();

    res.status(201).json({ message: 'Task created successfully', task });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getAllTasks = async (req, res) => {
  try {
    console.log('req.user:', req.user);

     const company = await getCompanyIdFromUser (req.user);
    // const company = req.user.userId ? req.user.userId.toString() : null;
    if (!company) {
      return res.status(400).json({ message: 'Company ID not found in user data' });
    }

    const filters = { company };
    if (req.query.assignedTo) filters.assignedTo = req.query.assignedTo;
    if (req.query.createdBy) filters.createdBy = req.query.createdBy;
    if (req.query.department) filters.department = req.query.department;
    if (req.query.priority) filters.priority = req.query.priority;
    if (req.query.repeat) filters.repeat = req.query.repeat === 'true';

  console.log("filters",filters);

    const tasks = await Task.find(filters)
      .populate('assignedTo', 'firstName role')
      .populate('createdBy', 'firstName role')
      .sort({ createdAt: -1 });

    res.json({ tasks });
  } catch (error) {
    console.error('Get all tasks error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


exports.getTaskById = async (req, res) => {
  try {
    const { id } = req.params;
      // const company = req.user.userId;
           const company = await getCompanyIdFromUser (req.user);

    const task = await Task.findOne({ _id: id, company})
      .populate('assignedTo', 'firstName role')
      .populate('createdBy', 'firstName role')
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    res.json({ task });
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

//         http://localhost:5000/api/task/68ccdea7f1bc215434418627/shifttask

//         {
//  "newAssigneeId": "68ccffbaff9a30d5b5910c7c",
//   "description":"gsdgydsfhgfds sd  yudf ygugtry"
// }


// {
//    "task":"68cd0683ff9a30d5b5911118",
//   "status": "in-progress",
//   "description":"ghsgs",
//   "nextFollowUp": "2025-02-02"
// }

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

    // Fetch existing task to append files
    const existingTask = await Task.findOne({ _id: id, company });
    if (!existingTask) {
      return res.status(404).json({ message: 'Task not found or not authorized' });
    }

    // Extract uploaded file URLs from req.files (if using multer-cloudinary)
    const images = req.files && req.files['images'] ? req.files['images'].map(f => f.path) : [];
    const audios = req.files && req.files['audios'] ? req.files['audios'].map(f => f.path) : [];
    const files = req.files && req.files['files'] ? req.files['files'].map(f => f.path) : [];

    // Append new files to existing arrays
    updateData.images = [...(existingTask.images || []), ...images];
    updateData.audios = [...(existingTask.audios || []), ...audios];
    updateData.files = [...(existingTask.files || []), ...files];

    // Update the task
    const task = await Task.findOneAndUpdate(
      { _id: id, company },
      updateData,
      { new: true, runValidators: true }
    );

    console.log("updateData----",updateData);
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found or not authorized' });
    }

    res.json({ message: 'Task updated successfully', task });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};



exports.deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    
    // const company = req.user.userId;
    const company = await getCompanyIdFromUser (req.user);

    const task = await Task.findOneAndDelete({ _id: id, company });
    if (!task) {
      return res.status(404).json({ message: 'Task not found or not authorized' });
    }
    res.json({ message: 'Task deleted successfully' });
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