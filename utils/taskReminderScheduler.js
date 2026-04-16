// utils/taskReminderScheduler.js
// Sends task reminder notifications to each employee 3x/day:
//   Morning   — 9:00 AM
//   Afternoon — 1:00 PM
//   Evening   — 6:00 PM

const cron = require('node-cron');
const mongoose = require('mongoose');
const Task = require('../models/Task');
const Notification = require('../models/Notification');
const { emitToUser } = require('../config/socket');

// Statuses that count as "remaining work"
const INCOMPLETE_STATUSES = [
  'pending',
  'in-progress',
  'reopened',
  're-in-progress',
  'in-progress(Overdue)',
  'reopened(Overdue)',
  're-in-progress(Overdue)',
];

const SLOT_LABELS = {
  morning: 'Morning Reminder',
  afternoon: 'Afternoon Reminder',
  evening: 'Evening Reminder',
};

async function sendReminders(slot) {
  try {
    console.log(`[TaskReminder] Running ${slot} reminder job...`);

    // Aggregate all incomplete tasks grouped by assignee
    const groups = await Task.aggregate([
      {
        $match: {
          status: { $in: INCOMPLETE_STATUSES },
          isRecurringInstance: { $ne: true }, // skip child instances to avoid duplicates
        },
      },
      { $unwind: '$assignedTo' },
      {
        $group: {
          _id: '$assignedTo',
          taskCount: { $sum: 1 },
          taskTitles: { $push: '$title' },
          companyId: { $first: '$company' },
        },
      },
    ]);

    if (!groups.length) {
      console.log(`[TaskReminder] No pending tasks found for ${slot} reminder.`);
      return;
    }

    const title = SLOT_LABELS[slot];
    const notifications = [];

    for (const group of groups) {
      const empId = group._id;
      const count = group.taskCount;
      const companyId = group.companyId;

      if (!empId || !mongoose.Types.ObjectId.isValid(empId.toString())) continue;

      // Build a short preview of task titles (max 3)
      const preview = group.taskTitles.slice(0, 3).join(', ');
      const extra = count > 3 ? ` (+${count - 3} more)` : '';
      const message = `You have ${count} pending task${count > 1 ? 's' : ''}: ${preview}${extra}`;

      notifications.push({
        recipient: empId,
        type: 'task',
        title,
        message,
        relatedId: undefined,
        meta: {
          priority: 'medium',
          companyId: companyId || undefined,
          companyName: '',
        },
      });
    }

    if (!notifications.length) return;

    const created = await Notification.insertMany(notifications);
    created.forEach((n) => {
      emitToUser(n.recipient, 'notification:new', {
        id: n._id,
        type: n.type,
        title: n.title,
        message: n.message,
        relatedId: n.relatedId,
        createdAt: n.createdAt,
        meta: n.meta,
      });
    });

    console.log(`[TaskReminder] ${slot} — sent ${created.length} reminder notifications.`);
  } catch (err) {
    console.error(`[TaskReminder] Error in ${slot} reminder:`, err.message);
  }
}

function startTaskReminderScheduler() {
  // Morning  — 9:00 AM  (cron: 0 9 * * *)
  cron.schedule('0 9 * * *', () => sendReminders('morning'), { timezone: 'Asia/Kolkata' });

  // Afternoon — 1:00 PM  (cron: 0 13 * * *)
  cron.schedule('0 13 * * *', () => sendReminders('afternoon'), { timezone: 'Asia/Kolkata' });

  // Evening  — 6:00 PM  (cron: 0 18 * * *)
  cron.schedule('0 18 * * *', () => sendReminders('evening'), { timezone: 'Asia/Kolkata' });

  console.log('[TaskReminder] Scheduler started — reminders at 9:00 AM, 1:00 PM, 6:00 PM IST');
}

module.exports = { startTaskReminderScheduler };
