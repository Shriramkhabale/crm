const Employee = require('../models/Employee');
const Task = require('../models/Task');
const Project = require('../models/ProjectMgnt');
const SupportTicket = require('../models/SupportTicket');

exports.getNotifications = async (req, res) => {
    // Dummy implementation returning empty array as requested to fix 404
    res.json([]);
};

exports.getEmployeeCount = async (req, res) => {
    try {
        // You might want to filter by company/superadmin based on req.user
        // For now, returning total count to fix the 500 error
        const count = await Employee.countDocuments();
        res.json({ count, change: 0 });
    } catch (error) {
        console.error('Error fetching employee count:', error);
        res.status(500).json({ message: 'Error fetching employee count', error });
    }
};

exports.getTaskStats = async (req, res) => {
    try {
        const completed = await Task.countDocuments({ status: 'Completed' });
        res.json({ completed, change: 0 });
    } catch (error) {
        console.error('Error fetching task stats:', error);
        res.status(500).json({ message: 'Error fetching task stats', error });
    }
};

exports.getProjectCount = async (req, res) => {
    try {
        const count = await Project.countDocuments();
        res.json({ count, change: 0 });
    } catch (error) {
        console.error('Error fetching project count:', error);
        res.status(500).json({ message: 'Error fetching project count', error });
    }
};

exports.getTicketCount = async (req, res) => {
    try {
        const count = await SupportTicket.countDocuments();
        res.json({ count, change: 0 });
    } catch (error) {
        console.error('Error fetching ticket count:', error);
        res.status(500).json({ message: 'Error fetching ticket count', error });
    }
};
