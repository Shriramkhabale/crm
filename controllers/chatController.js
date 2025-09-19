//controller/chatController.js

const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const mongoose = require('mongoose');

exports.createConversation = async (req, res) => {
  try {
    const { participantIds, isGroup, name } = req.body;
    const userId = req.user._id;
    const companyId = req.user.company;

    if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
      return res.status(400).json({ message: 'Participants are required' });
    }

    // Ensure all participants belong to same company (optional validation)

    const conversation = new Conversation({
      company: companyId,
      isGroup: !!isGroup,
      name: isGroup ? name : null,
      participants: [...new Set([...participantIds, userId])], // include creator
      createdBy: userId
    });

    await conversation.save();

    res.status(201).json({ conversation });
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content, type } = req.body;
    const userId = req.user._id;

    if (!content) {
      return res.status(400).json({ message: 'Message content is required' });
    }

    // Validate conversation exists and user is participant
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });
    if (!conversation.participants.includes(userId)) {
      return res.status(403).json({ message: 'Not a participant of this conversation' });
    }

    const message = new Message({
      conversation: conversationId,
      sender: userId,
      content,
      type: type || 'text'
    });

    await message.save();

    res.status(201).json({ message });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });
    if (!conversation.participants.includes(userId)) {
      return res.status(403).json({ message: 'Not a participant of this conversation' });
    }

    // Fetch messages excluding those deleted for this user or deleted for all
    const messages = await Message.find({
      conversation: conversationId,
      deletedForAll: false,
      deletedFor: { $ne: userId }
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('sender', 'name email');

    res.json({ messages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.markMessageViewed = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    // Upsert viewed status
    await MessageViewStatus.findOneAndUpdate(
      { message: messageId, user: userId },
      { viewedAt: new Date() },
      { upsert: true, new: true }
    );

    res.json({ message: 'Message marked as viewed' });
  } catch (error) {
    console.error('Mark message viewed error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { deleteForAll } = req.body; // boolean
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: 'Message not found' });

    if (deleteForAll) {
      // Only sender or admin can delete for all
      if (!message.sender.equals(userId)) {
        return res.status(403).json({ message: 'Not authorized to delete for all' });
      }
      message.deletedForAll = true;
      await message.save();
    } else {
      // Delete for self only
      if (!message.deletedFor.includes(userId)) {
        message.deletedFor.push(userId);
        await message.save();
      }
    }

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};