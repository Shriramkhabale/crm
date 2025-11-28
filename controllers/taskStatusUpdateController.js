//controller/taskStatusUpdateController.js

const Task = require('../models/Task');
const TaskStatusUpdate = require('../models/TaskStatusUpdate');
const Employee = require('../models/Employee');
const mongoose = require('mongoose');


async function getCompanyIdFromUser(user) {
  if (user.role === 'company') {
    return user.userId; // userId is companyId
  } else {
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


    res.json({ shiftedTasks: shiftedStatusUpdates });
  } catch (error) {
    console.error('getShiftedTasks error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};



exports.getReassignedTasksForCompany = async (req, res) => {
  try {
    // Get company ID from logged-in user
    const companyId = await getCompanyIdFromUser(req.user);
    if (!companyId) {
      return res.status(400).json({ message: 'Company ID not found for user' });
    }

    // Pagination parameters (default to paginated; override for "all")
    const page = parseInt(req.query.page, 10) || 1;
    let limit = parseInt(req.query.limit, 10) || 20;
    const all = req.query.all === 'true'; // ?all=true to fetch everything

    if (all) {
      limit = 10000; // High limit for "all" (adjust based on data size)
      console.log(`Fetching ALL reassigned tasks for company ${companyId} (limit: ${limit})`);
    } else {
      console.log(`Fetching paginated reassigned tasks for company ${companyId} (page: ${page}, limit: ${limit})`);
    }

    const skip = all ? 0 : (page - 1) * limit; // No skip for "all"

    // STEP 1: Get total count (simple aggregation – no joins for speed)
    const countPipeline = [
      {
        $match: {
          status: 'reassigned', // Explicitly match reassigned status
          oldAssigneeId: { $exists: true, $ne: null }, // Only reassigned
          shiftedBy: { $exists: true, $ne: null } // Ensure shiftedBy exists (non-null)
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
      { $unwind: { path: '$taskDetails', preserveNullAndEmptyArrays: true } },
      {
        $match: {
          'taskDetails.company': new mongoose.Types.ObjectId(companyId)
        }
      },
      { $count: 'totalCount' }
    ];

    console.log("countPipeline", countPipeline);

    const countResult = await TaskStatusUpdate.aggregate(countPipeline);
    console.log("countResult", countResult);

    const totalCount = countResult.length > 0 ? countResult[0].totalCount : 0;
    console.log(`Total reassigned tasks for company ${companyId}: ${totalCount}`);

    if (totalCount === 0) {
      return res.json({
        success: true,
        page: all ? 1 : page,
        limit: all ? totalCount : limit,
        totalCount,
        hasMore: false,
        reassignedTasks: [] // Empty array for no results
      });
    }

    // STEP 2: Get paginated/all data with joins/populations
    const dataPipeline = [
      {
        $match: {
          status: 'reassigned', // Explicitly match reassigned status
          oldAssigneeId: { $exists: true, $ne: null },
          shiftedBy: { $exists: true, $ne: null } // Ensure shiftedBy exists (non-null)
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
      { $unwind: { path: '$taskDetails', preserveNullAndEmptyArrays: true } },
      {
        $match: {
          'taskDetails.company': new mongoose.Types.ObjectId(companyId)
        }
      },
      {
        $sort: { updatedAt: -1 } // Most recent first
      },
      { $skip: skip },
      { $limit: limit },
      // FIXED: Lookup for shiftedBy - REMOVED company filter to allow matching
      {
        $lookup: {
          from: 'employees',
          localField: 'shiftedBy',
          foreignField: '_id',
          as: 'shiftedByDetails',
          pipeline: [
            {
              $match: {
                _id: { $exists: true, $ne: null } // Only ensure valid document, no company filter
              }
            },
            {
              $project: {
                firstName: 1,
                lastName: 1,
                email: 1,
                role: 1,
                teamMemberName: 1,
                _id: 1
              }
            }
          ]
        }
      },
      { $unwind: { path: '$shiftedByDetails', preserveNullAndEmptyArrays: true } },
      // FIXED: Always create full shiftedBy object with explicit fallbacks
      {
        $addFields: {
          shiftedBy: {
            _id: { $toString: '$shiftedBy' }, // Always string ID
            teamMemberName: {
              $ifNull: [
                '$shiftedByDetails.teamMemberName',
                {
                  $cond: {
                    if: { $eq: [{ $toString: '$shiftedBy' }, companyId] },
                    then: 'Company Admin',
                    else: { $concat: ['Unknown Shifter (ID: ', { $toString: '$shiftedBy' }, ')'] }
                  }
                }
              ]
            },
            firstName: {
              $ifNull: [
                '$shiftedByDetails.firstName',
                {
                  $cond: {
                    if: { $eq: [{ $toString: '$shiftedBy' }, companyId] },
                    then: 'Company',
                    else: null
                  }
                }
              ]
            },
            lastName: {
              $ifNull: [
                '$shiftedByDetails.lastName',
                {
                  $cond: {
                    if: { $eq: [{ $toString: '$shiftedBy' }, companyId] },
                    then: 'Admin',
                    else: null
                  }
                }
              ]
            },
            email: { $ifNull: ['$shiftedByDetails.email', null] },
            role: {
              $ifNull: [
                '$shiftedByDetails.role',
                {
                  $cond: {
                    if: { $eq: [{ $toString: '$shiftedBy' }, companyId] },
                    then: 'Company',
                    else: 'Unknown'
                  }
                }
              ]
            }
          }
        }
      },
      // FIXED: Lookup for oldAssignee - REMOVED company filter
      {
        $lookup: {
          from: 'employees',
          localField: 'oldAssigneeId',
          foreignField: '_id',
          as: 'oldAssigneeDetails',
          pipeline: [
            {
              $match: {
                _id: { $exists: true, $ne: null } // No company filter
              }
            },
            {
              $project: {
                firstName: 1,
                lastName: 1,
                email: 1,
                role: 1,
                teamMemberName: 1,
                _id: 1
              }
            }
          ]
        }
      },
      { $unwind: { path: '$oldAssigneeDetails', preserveNullAndEmptyArrays: true } },
      // FIXED: Always create full oldAssignee object with explicit fallbacks
      {
        $addFields: {
          oldAssignee: {
            _id: { $toString: '$oldAssigneeId' }, // Always string ID
            teamMemberName: {
              $ifNull: [
                '$oldAssigneeDetails.teamMemberName',
                { $concat: ['Unknown Assignee (ID: ', { $toString: '$oldAssigneeId' }, ')'] }
              ]
            },
            firstName: { $ifNull: ['$oldAssigneeDetails.firstName', null] },
            lastName: { $ifNull: ['$oldAssigneeDetails.lastName', null] },
            email: { $ifNull: ['$oldAssigneeDetails.email', null] },
            role: { $ifNull: ['$oldAssigneeDetails.role', 'Unknown'] }
          }
        }
      },
      // Project final structure (clean and consistent)
      {
        $project: {
          _id: { $toString: '$_id' }, // Stringify status update ID
          status: 1,
          description: 1,
          givenCreditPoints: 1,
          image: 1,
          file: 1,
          audio: 1,
          nextFollowUpDateTime: 1,
          updatedAt: 1,
          task: {
            _id: { $toString: '$taskDetails._id' },
            title: '$taskDetails.title',
            description: '$taskDetails.description',
            status: '$taskDetails.status',
            priority: '$taskDetails.priority',
            startDateTime: '$taskDetails.startDateTime',
            endDateTime: '$taskDetails.endDateTime',
            assignedTo: '$taskDetails.assignedTo',
            department: '$taskDetails.department'
          },
          shiftedBy: 1, // Full object with fallbacks
          oldAssignee: 1 // Full object with fallbacks
        }
      }
    ];

    console.log("dataPipeline", dataPipeline); // Debug: Log pipeline for verification

    const dataResult = await TaskStatusUpdate.aggregate(dataPipeline);

    // Handle large "all" results (optional warning)
    if (all && dataResult.length > 5000) {
      console.warn(`Large result set (${dataResult.length}) for "all" query – consider pagination for UI`);
    }

    const hasMore = !all && (skip + dataResult.length < totalCount);

    res.json({
      success: true,
      page: all ? 1 : page, // Treat "all" as single page
      limit: all ? totalCount : limit,
      totalCount,
      hasMore,
      reassignedTasks: dataResult // Array of reassigned tasks
    });

  } catch (error) {
    console.error('getReassignedTasksForCompany error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
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


    console.log("req.body222", req.body);

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
    console.log("task---0--0-0-000-", task);

    await task.save();

    // Extract uploaded file URLs
    const image = req.files && req.files.image ? req.files.image[0].path : undefined;
    const file = req.files && req.files.file ? req.files.file[0].path : undefined;
    const audio = req.files && req.files.audio ? req.files.audio[0].path : undefined;

    console.log("followUpDate", nextFollowUpDateTime);

    // Save status update history
    const statusUpdate = new TaskStatusUpdate({
      task: taskId,
      status,
      description,
      givenCreditPoints,
      image,
      file,
      audio,
      nextFollowUpDateTime: nextFollowUpDateTime || undefined
    });

    await statusUpdate.save();

    res.json({ message: 'Task status and next follow-up updated', task, statusUpdate });
  } catch (error) {
    console.error('Update task status error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
