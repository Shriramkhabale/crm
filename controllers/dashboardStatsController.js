const Employee = require('../models/Employee');
const Task = require('../models/Task');
const Project = require('../models/ProjectMgnt');
const SupportTicket = require('../models/SupportTicket');
const Notification = require('../models/Notification');
const mongoose = require('mongoose');

exports.getNotifications = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.json([]);
        }
        const items = await Notification.find({ recipient: userId })
            .sort({ createdAt: -1 })
            .limit(20)
            .lean();
        const data = items.map(n => ({
            id: n._id,
            type: n.type,
            title: n.title || (n.type === 'task' ? 'Task Assigned' : n.type === 'ticket' ? 'Ticket Assigned' : 'Lead Assigned'),
            message: n.message,
            unread: !n.isRead,
            createdAt: n.createdAt,
            relatedId: n.relatedId
        }));
        res.json(data);
    } catch (e) {
        console.error('Error fetching notifications:', e);
        res.json([]);
    }
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
