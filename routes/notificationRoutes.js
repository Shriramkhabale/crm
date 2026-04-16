const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const Notification = require('../models/Notification');
const mongoose = require('mongoose');
const { emitToUser } = require('../config/socket');

// List notifications for current user (most recent first)
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.json([]);
    }

    const data = await Notification.find({ recipient: userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json(data.map(n => ({
      id: n._id,
      type: n.type,
      title: n.title || (n.type === 'task' ? 'Task Assigned' : n.type === 'ticket' ? 'Ticket Assigned' : 'Lead Assigned'),
      message: n.message,
      unread: !n.isRead,
      createdAt: n.createdAt,
      meta: n.meta || {},
      relatedId: n.relatedId
    })));
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ message: 'Error fetching notifications' });
  }
});

// Unread count
router.get('/unread-count', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.json({ count: 0 });
    }
    const count = await Notification.countDocuments({ recipient: userId, isRead: false });
    res.json({ count });
  } catch (err) {
    console.error('Error counting notifications:', err);
    res.status(500).json({ message: 'Error counting notifications' });
  }
});

// Mark single as read
router.patch('/:id/read', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid notification id' });
    }
    const updated = await Notification.findOneAndUpdate(
      { _id: id, recipient: userId },
      { $set: { isRead: true, updatedAt: new Date() } },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.json({ message: 'Marked as read' });
  } catch (err) {
    console.error('Error marking read:', err);
    res.status(500).json({ message: 'Error marking notification as read' });
  }
});

// Mark all as read
router.put('/mark-all-read', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await Notification.updateMany(
      { recipient: userId, isRead: false },
      { $set: { isRead: true, updatedAt: new Date() } }
    );
    res.json({ message: 'All notifications marked as read', count: result.modifiedCount || 0 });
  } catch (err) {
    console.error('Error marking all read:', err);
    res.status(500).json({ message: 'Error marking all as read' });
  }
});

// Create multiple notifications (bulk) and emit in real-time
router.post('/bulk', auth, async (req, res) => {
  try {
    const { recipients, type, title, message, relatedId, meta } = req.body || {};
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ message: 'recipients array is required' });
    }
    if (!type || !message) {
      return res.status(400).json({ message: 'type and message are required' });
    }
    const docs = recipients
      .filter(id => mongoose.Types.ObjectId.isValid(id))
      .map(id => ({
        recipient: new mongoose.Types.ObjectId(id),
        type,
        title: title || undefined,
        message,
        relatedId: relatedId && mongoose.Types.ObjectId.isValid(relatedId) ? new mongoose.Types.ObjectId(relatedId) : undefined,
        meta: meta || {}
      }));
    if (docs.length === 0) {
      return res.status(400).json({ message: 'No valid recipient ids provided' });
    }
    const created = await Notification.insertMany(docs);
    created.forEach(n => {
      emitToUser(n.recipient, 'notification:new', {
        id: n._id,
        type: n.type,
        title: n.title || (n.type === 'task' ? 'Task Assigned' : n.type === 'ticket' ? 'Ticket Assigned' : 'Lead Assigned'),
        message: n.message,
        relatedId: n.relatedId,
        createdAt: n.createdAt,
        meta: n.meta
      });
    });
    res.json({ success: true, count: created.length });
  } catch (err) {
    console.error('Error creating notifications:', err);
    res.status(500).json({ message: 'Error creating notifications' });
  }
});

// Delete a single notification
router.delete('/:id', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid notification id' });
    }
    const deleted = await Notification.findOneAndDelete({ _id: id, recipient: userId });
    if (!deleted) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.json({ message: 'Notification deleted' });
  } catch (err) {
    console.error('Error deleting notification:', err);
    res.status(500).json({ message: 'Error deleting notification' });
  }
});

module.exports = router;
