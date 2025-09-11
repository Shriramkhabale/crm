//controller/taskStatusUpdateController.js

const Task = require('../models/Task');
const TaskStatusUpdate = require('../models/TaskStatusUpdate');

exports.updateTaskStatus = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status, description, image, file, audio, nextFollowUp, nextFollowUpDateTime } = req.body;

    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    // Validate nextFollowUpDateTime if status requires it
    const statusesWithFollowUp = ['inprogress', 'reopen'];
    let followUpDate = null;
    if (statusesWithFollowUp.includes(status.toLowerCase())) {
      // Prefer nextFollowUpDateTime if provided, else nextFollowUp
      const nextFollowUpValue = nextFollowUpDateTime || nextFollowUp;
      if (!nextFollowUpValue) {
        return res.status(400).json({ message: 'Next Follow Up date/time is required for this status' });
      }
      followUpDate = new Date(nextFollowUpValue);
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
    if (followUpDate) {
      task.nextFollowUpDateTime = followUpDate;
    }
    await task.save();

    // Save status update history
    const statusUpdate = new TaskStatusUpdate({
      task: taskId,
      status,
      description,
      image,
      file,
      audio,
      nextFollowUp: followUpDate || undefined
    });

    await statusUpdate.save();

    res.json({ message: 'Task status and next follow-up updated', task, statusUpdate });
  } catch (error) {
    console.error('Update task status error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


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
