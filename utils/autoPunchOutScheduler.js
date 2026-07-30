// utils/autoPunchOutScheduler.js
// Runs at midnight (00:00) every day (in the server's local timezone).
// Finds all attendance records with at least one open punch session and
// auto-closes them with source = "AUTO_MIDNIGHT".

const cron = require('node-cron');
const Attendance = require('../models/Attendance');
const LocationTracking = require('../models/LocationTracking');

/**
 * Close every open punch session found in all attendance documents
 * whose date matches yesterday (the day that just ended at midnight).
 */
async function runAutoPunchOut() {
  const now = new Date();

  // "Yesterday" — the calendar day that just ended
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const dayStart = new Date(Date.UTC(
    yesterday.getUTCFullYear(),
    yesterday.getUTCMonth(),
    yesterday.getUTCDate(),
    0, 0, 0, 0
  ));
  const dayEnd = new Date(Date.UTC(
    yesterday.getUTCFullYear(),
    yesterday.getUTCMonth(),
    yesterday.getUTCDate(),
    23, 59, 59, 999
  ));

  console.log(`[AutoPunchOut] Running at ${now.toISOString()} for date range ${dayStart.toISOString()} → ${dayEnd.toISOString()}`);

  // The auto punch-out timestamp is just before midnight of the attendance day
  const autoPunchOutTime = new Date(Date.UTC(
    yesterday.getUTCFullYear(),
    yesterday.getUTCMonth(),
    yesterday.getUTCDate(),
    23, 59, 59, 0
  ));

  try {
    // Find all attendance records for yesterday that have at least one open punch
    const openAttendances = await Attendance.find({
      date: { $gte: dayStart, $lte: dayEnd },
      'punches': {
        $elemMatch: { outTime: null }
      }
    });

    if (openAttendances.length === 0) {
      console.log('[AutoPunchOut] No open sessions found. Nothing to do.');
      return;
    }

    console.log(`[AutoPunchOut] Found ${openAttendances.length} record(s) with open punch sessions.`);

    let closedCount = 0;

    for (const attendance of openAttendances) {
      let modified = false;
      let totalWorkingMinutes = 0;

      for (let i = attendance.punches.length - 1; i >= 0; i--) {
        const punch = attendance.punches[i];

        if (!punch.outTime) {
          // Safety: only auto-close if inTime is before the auto punch-out time
          const punchInTime = new Date(punch.inTime);
          const effectiveOutTime = punchInTime < autoPunchOutTime
            ? autoPunchOutTime
            : new Date(punchInTime.getTime() + 60 * 1000); // at least 1 min after in

          punch.outTime = effectiveOutTime;
          punch.outLocation = null;
          punch.outPhoto = null;
          punch.isAutoPunchOut = true;
          punch.punchOutSource = 'AUTO_MIDNIGHT';
          punch.outPhotoMissingReason = 'AUTO_PUNCH_OUT';

          modified = true;
          closedCount++;
        }

        // Accumulate working time for all completed punches
        if (punch.inTime && punch.outTime) {
          const diff = (new Date(punch.outTime) - new Date(punch.inTime)) / 1000 / 60;
          totalWorkingMinutes += Math.max(0, diff);
        }
      }

      if (modified) {
        // Root-document summary fields (backward compatibility)
        const lastPunch = attendance.punches[attendance.punches.length - 1];
        attendance.outTime = lastPunch.outTime;
        attendance.outLocation = null;
        attendance.isAutoPunchOut = true;
        attendance.autoPunchOut = true;
        attendance.punchOutSource = 'AUTO_MIDNIGHT';
        attendance.punchOutType = 'automatic';
        attendance.outPhotoMissingReason = 'AUTO_PUNCH_OUT';
        attendance.workingTime = totalWorkingMinutes;

        attendance.markModified('punches');
        await attendance.save();
      }
    }

    console.log(`[AutoPunchOut] Closed ${closedCount} open session(s) successfully.`);
  } catch (err) {
    console.error('[AutoPunchOut] Error during auto punch-out:', err);
  }

  // ── Stop location tracking for all active sessions from yesterday ──
  try {
    const result = await LocationTracking.updateMany(
      {
        status: 'active',
        startTime: { $gte: dayStart, $lte: dayEnd }
      },
      {
        $set: {
          status: 'completed',
          endTime: autoPunchOutTime,
          notes: 'Auto-stopped at midnight by scheduler'
        }
      }
    );
    console.log(`[AutoPunchOut] Stopped ${result.modifiedCount} active location-tracking session(s).`);
  } catch (err) {
    console.error('[AutoPunchOut] Error stopping location tracking:', err);
  }
}

/**
 * Start the scheduler.
 * Fires at 00:01 every day (1 minute after midnight) to ensure the day has rolled over.
 */
function startAutoPunchOutScheduler() {
  if (global.__AUTO_PUNCHOUT_STARTED) {
    console.log('[AutoPunchOut] Scheduler already running, skipping duplicate initialization.');
    return;
  }

  // '1 0 * * *' → every day at 00:01 (5-field node-cron format)
  cron.schedule('1 0 * * *', () => {
    console.log('[AutoPunchOut] Midnight cron triggered.');
    runAutoPunchOut();
  }, {
    timezone: process.env.CRON_TIMEZONE || 'Asia/Kolkata'  // Set CRON_TIMEZONE in .env if needed
  });

  global.__AUTO_PUNCHOUT_STARTED = true;
  console.log('[AutoPunchOut] Midnight scheduler started — fires at 00:01 IST daily.');
}

module.exports = { startAutoPunchOutScheduler, runAutoPunchOut };
