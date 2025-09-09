// controller/taskController.js

const Task = require('../models/Task');
const Employee = require('../models/Employee');

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
      repeatFrequency,
      repeatDaysOfWeek,
      repeatDatesOfMonth,
      priority,
      nextFollowUpDateTime,
      nextFinishDateTime,
      branch,
      createdBy,
      company: bodyCompany
    } = req.body;


    // const createdBy = req.user.userId; // from auth middleware
    const company = req.user.companyId || bodyCompany; // from auth middleware
console.log("createdBy",createdBy);

const companyStr = company.toString();
    // Basic required fields
    if (!title || !department || !assignedTo || !startDateTime || !endDateTime) {
      return res.status(400).json({ message: 'Title, department, assignedTo, startDateTime, and endDateTime are required' });
    }

console.log("company",company);
console.log("assignedTo",assignedTo);
console.log("Employee",Employee);

  // Validate assignedTo user exists and belongs to same company
// const assignee = await Employee.findOne({ _id: assignedTo, company: companyStr });
const assignee = await Employee.findOne({ _id: assignedTo, company: company.toString() });


if (!assignee) {
      return res.status(400).json({ message: 'Assigned user not found in your company' });
    }

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

    // Create task document
    const task = new Task({
      title,
      description,
      department,
      assignedTo,
      startDateTime,
      endDateTime,
      repeat,
      repeatFrequency: repeat ? repeatFrequency : undefined,
      repeatDaysOfWeek: repeat && repeatFrequency === 'weekly' ? repeatDaysOfWeek : undefined,
      repeatDatesOfMonth: repeat && repeatFrequency === 'monthly' ? repeatDatesOfMonth : undefined,
      priority: priority || 'medium',
      nextFollowUpDateTime: !repeat ? nextFollowUpDateTime : undefined,
      nextFinishDateTime: repeat ? nextFinishDateTime : undefined,
      company,
      branch,
      createdBy,
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
  console.log("company",company);

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
      .populate('branch', 'name')
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
      .populate('branch', 'name');
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
    console.log("req.user",req.user);
         const company = await getCompanyIdFromUser (req.user);

    // const company = req.user.userId;
    const updateData = req.body;
    // Optional: Validate repeat fields if they are updated
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
      const assignee = await Employee.findOne({ _id: updateData.assignedTo, company });
      if (!assignee) {
        return res.status(400).json({ message: 'Assigned user not found in your company' });
      }
    }
    const task = await Task.findOneAndUpdate(
      { _id: id, company },
      updateData,
      { new: true, runValidators: true }
    );
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
