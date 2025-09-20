const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const ProjectMgnt = require('../models/ProjectMgnt');
const Task = require('../models/Task');
const SupportTicket = require('../models/SupportTicket');
const Attendance = require('../models/Attendance');

/**
 * Get total employees count
 */
exports.getTotalEmployees = async (req, res) => {
  try {
    const companyId = req.companyId;
    const totalEmployees = await Employee.countDocuments({ company: companyId });
    res.json({ totalEmployees });
  } catch (error) {
    console.error('getTotalEmployees error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Get total projects count
 */
exports.getTotalProjects = async (req, res) => {
  try {
    const companyId = req.companyId;
    const totalProjects = await ProjectMgnt.countDocuments({ company: companyId });
    res.json({ totalProjects });
  } catch (error) {
    console.error('getTotalProjects error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Get tasks count grouped by status
 */

exports.getTasksByStatus = async (req, res) => {
  try {
    const companyId = req.companyId;
    let companyObjectId;
    try {
      companyObjectId = new mongoose.Types.ObjectId(companyId);
    } catch (err) {
      return res.status(400).json({ message: 'Invalid companyId format' });
    }

    const tasksByStatusRaw = await Task.aggregate([
      { $match: { company: companyObjectId } },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);
    const tasksByStatus = {};
    tasksByStatusRaw.forEach(item => {
      tasksByStatus[item._id] = item.count;
    });
    res.json({ tasksByStatus });
  } catch (error) {
    console.error('getTasksByStatus error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};


/**
 * Get total support tickets count
 */
exports.getTotalTickets = async (req, res) => {
  try {
    const companyId = req.companyId;
    const totalTickets = await SupportTicket.countDocuments({ companyId: companyId });
    res.json({ totalTickets });
  } catch (error) {
    console.error('getTotalTickets error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Get today's present employees count
 */
exports.getTodaysPresentEmployees = async (req, res) => {
  try {
    const companyId = req.companyId;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const todaysPresentEmployees = await Attendance.countDocuments({
      company: companyId,
      date: { $gte: todayStart, $lt: todayEnd },
      status: 'present'
    });

    res.json({ todaysPresentEmployees });
  } catch (error) {
    console.error('getTodaysPresentEmployees error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Bonus: Get tasks created per day for last 7 days
 */
exports.getTasksLast7Days = async (req, res) => {
  try {
    const companyId = req.companyId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const tasksByDay = await Task.aggregate([
      { $match: { 
          company: new mongoose.Types.ObjectId(companyId),
          createdAt: { $gte: sevenDaysAgo, $lte: today }
        } 
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({ tasksByDay });
  } catch (error) {
    console.error('getTasksLast7Days error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
