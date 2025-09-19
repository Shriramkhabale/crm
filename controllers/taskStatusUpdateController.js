//controller/taskStatusUpdateController.js

const Task = require('../models/Task');
const TaskStatusUpdate = require('../models/TaskStatusUpdate');
const Employee = require('../models/Employee');
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


// exports.updateTaskStatus = async (req, res) => {
//   try {
//     const { taskId } = req.params;
//     const { status, description, image, file, audio,givenCreditPoints, nextFollowUpDateTime } = req.body;

//     if (!status) {
//       return res.status(400).json({ message: 'Status is required' });
//     }

//     // Validate nextFollowUpDateTime if status requires it
//     const statusesWithFollowUp = ['inprogress', 'reopen'];
//     let followUpDate = null;
//     if (statusesWithFollowUp.includes(status.toLowerCase())) {
//       // Prefer nextFollowUpDateTime if provided, else nextFollowUp
//       const nextFollowUpValue = nextFollowUpDateTime ;
//       if (!nextFollowUpValue) {
//         return res.status(400).json({ message: 'Next Follow Up date/time is required for this status' });
//       }
//       followUpDate = new Date(nextFollowUpValue);
//       if (isNaN(followUpDate)) {
//         return res.status(400).json({ message: 'Invalid Next Follow Up date/time' });
//       }
//     }

//     // Find the task
//     const task = await Task.findById(taskId);
//     if (!task) {
//       return res.status(404).json({ message: 'Task not found' });
//     }

//     // Update task status and nextFollowUpDateTime
//     task.status = status;
//      task.nextFollowUpDateTime = nextFollowUpDateTime;
  
//     await task.save();

//     // Save status update history
//     const statusUpdate = new TaskStatusUpdate({
//       task: taskId,
//       status,
//       description,
//       givenCreditPoints,
//       image,
//       file,
//       audio,
//       nextFollowUpDateTime: followUpDate || undefined
//     });

//     await statusUpdate.save();

//     res.json({ message: 'Task status and next follow-up updated', task, statusUpdate });
//   } catch (error) {
//     console.error('Update task status error:', error);
//     res.status(500).json({ message: 'Server error', error: error.message });
//   }
// };


exports.getTaskStatusUpdates = async (req, res) => {
  try {
    const { taskId } = req.params;
    const updates = await TaskStatusUpdate.find({ task: taskId }).sort({ updatedAt: -1 });
    res.json({ updates });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};



exports.getShiftedTasks = async (req, res) => {
  try {
    const { shiftedBy, newAssignee, companyId, page = 1, limit = 20 } = req.query;

    const filter = {};

    // Filter TaskStatusUpdate by shiftedBy if provided
    if (shiftedBy) {
      filter.shiftedBy = shiftedBy;
    }

    // Filter TaskStatusUpdate by oldAssigneeId if provided (optional)
    if (newAssignee) {
      filter.oldAssigneeId = newAssignee;
    }

    // Find TaskStatusUpdates where tasks were shifted
    // We want only those with shiftedBy field set (non-null)
    filter.shiftedBy = { $exists: true, $ne: null };

    // Pagination
    const skip = (page - 1) * limit;

    // Find distinct task IDs from TaskStatusUpdate matching filter
    const shiftedStatusUpdates = await TaskStatusUpdate.find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('shiftedBy', 'name email') // populate shiftedBy employee info (adjust fields)
      .populate('oldAssigneeId', 'name email') // populate oldAssignee info
      .populate('task'); // populate task details

    // Optionally, you can return only unique tasks with latest shift info:
    // But here we return all matching status updates with task info

    res.json({ shiftedTasks: shiftedStatusUpdates });
  } catch (error) {
    console.error('getShiftedTasks error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};



exports.getReassignedTasksForCompany = async (req, res) => {
  try {
    const companyId = await getCompanyIdFromUser (req.user);
    if (!companyId) {
      return res.status(400).json({ message: 'Company ID not found for user' });
    }

    // Pagination params
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    // Aggregate TaskStatusUpdate documents where oldAssigneeId exists
    const reassignedTasks = await TaskStatusUpdate.aggregate([
      {
        $match: {
          oldAssigneeId: { $exists: true, $ne: null }
        }
      },
      {
        $lookup: {
          from: 'tasks',
          localField: 'task',
          foreignField: '_id',
          as: 'taskDetails'
        }
      },
      { $unwind: '$taskDetails' },
      {
        $match: {
          'taskDetails.company': new mongoose.Types.ObjectId(companyId)
        }
      },
      { $sort: { updatedAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'employees',
          localField: 'shiftedBy',
          foreignField: '_id',
          as: 'shiftedByDetails'
        }
      },
      { $unwind: { path: '$shiftedByDetails', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'employees',
          localField: 'oldAssigneeId',
          foreignField: '_id',
          as: 'oldAssigneeDetails'
        }
      },
      { $unwind: { path: '$oldAssigneeDetails', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          status: 1,
          description: 1,
          givenCreditPoints: 1,
          image: 1,
          file: 1,
          audio: 1,
          nextFollowUpDateTime: 1,
          updatedAt: 1,
          task: '$taskDetails',
          shiftedBy: '$shiftedByDetails',
          oldAssignee: '$oldAssigneeDetails'
        }
      }
    ]);

    res.json({
      page,
      limit,
      count: reassignedTasks.length,
      reassignedTasks
    });
  } catch (error) {
    console.error('getReassignedTasksForCompany error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};



exports.getReassignedTasksForCompany = async (req, res) => {
  try {
    // Get company ID from logged-in user
    const companyId = await getCompanyIdFromUser (req.user);
    if (!companyId) {
      return res.status(400).json({ message: 'Company ID not found for user' });
    }

    // Pagination parameters
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    // Aggregation pipeline
    const reassignedTasks = await TaskStatusUpdate.aggregate([
      {
        $match: {
          oldAssigneeId: { $exists: true, $ne: null }
        }
      },
      {
        $lookup: {
          from: 'tasks',
          localField: 'task',
          foreignField: '_id',
          as: 'taskDetails'
        }
      },
      { $unwind: '$taskDetails' },
      {
        $match: {
          'taskDetails.company': new mongoose.Types.ObjectId(companyId)
        }
      },
      {
        $sort: { updatedAt: -1 }
      },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'employees',
          localField: 'shiftedBy',
          foreignField: '_id',
          as: 'shiftedByDetails'
        }
      },
      { $unwind: { path: '$shiftedByDetails', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'employees',
          localField: 'oldAssigneeId',
          foreignField: '_id',
          as: 'oldAssigneeDetails'
        }
      },
      { $unwind: { path: '$oldAssigneeDetails', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          status: 1,
          description: 1,
          givenCreditPoints:1,
          image: 1,
          file: 1,
          audio: 1,
          nextFollowUpDateTime: 1,
          updatedAt: 1,
          task: '$taskDetails',
          shiftedBy: '$shiftedByDetails',
          oldAssignee: '$oldAssigneeDetails'
        }
      }
    ]);

    res.json({
      page,
      limit,
      count: reassignedTasks.length,
      reassignedTasks
    });
  } catch (error) {
    console.error('getReassignedTasksForCompany error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};




exports.updateTaskStatusWithFiles = async (req, res) => {
  try {
    const { taskId } = req.params;
    const {
      status,
      description,
      givenCreditPoints,
      nextFollowUpDateTime
    } = req.body;

    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    // Validate nextFollowUpDateTime if required
    const statusesWithFollowUp = ['inprogress', 'reopen'];
    let followUpDate = null;
    if (statusesWithFollowUp.includes(status.toLowerCase())) {
      if (!nextFollowUpDateTime) {
        return res.status(400).json({ message: 'Next Follow Up date/time is required for this status' });
      }
      followUpDate = new Date(nextFollowUpDateTime);
      if (isNaN(followUpDate)) {
        return res.status(400).json({ message: 'Invalid Next Follow Up date/time' });
      }
    }

    // Find the task
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Update task status and nextFollowUpDateTime
    task.status = status;
    task.nextFollowUpDateTime = nextFollowUpDateTime;
    await task.save();

    // Extract uploaded file URLs
    const image = req.files && req.files.image ? req.files.image[0].path : undefined;
    const file = req.files && req.files.file ? req.files.file[0].path : undefined;
    const audio = req.files && req.files.audio ? req.files.audio[0].path : undefined;

    // Save status update history
    const statusUpdate = new TaskStatusUpdate({
      task: taskId,
      status,
      description,
      givenCreditPoints,
      image,
      file,
      audio,
      nextFollowUpDateTime: followUpDate || undefined
    });

    await statusUpdate.save();

    res.json({ message: 'Task status and next follow-up updated', task, statusUpdate });
  } catch (error) {
    console.error('Update task status error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
