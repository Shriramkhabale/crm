const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const mongoose = require('mongoose');

// Create or get existing conversation between participants
exports.getOrCreateConversation = async (req, res) => {
  try {
    const { companyId, participants } = req.body;

    if (!companyId || !participants || !Array.isArray(participants) || participants.length < 2) {
      return res.status(400).json({ message: 'companyId and participants (array of at least 2 user IDs) are required' });
    }

    // Find conversation with exact same participants (order independent)
    let conversation = await Conversation.findOne({
      companyId,
      participants: { $all: participants, $size: participants.length },
      deletedFor: { $nin: participants } // none of the participants deleted it
    });

    if (!conversation) {
      conversation = new Conversation({
        companyId,
        participants,
        lastMessageAt: new Date()
      });
      await conversation.save();
    }

    res.json({ conversation });
  } catch (error) {
    console.error('getOrCreateConversation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Send a message in a conversation
exports.sendMessage = async (req, res) => {
  try {
    const { conversationId, sender, message, image, audio, file } = req.body;

    if (!conversationId || !sender || !message) {
      return res.status(400).json({ message: 'conversationId, sender, and message are required' });
    }

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ message: 'Invalid conversationId' });
    }

    const newMessage = new Message({
      conversationId,
      sender,
      message,
      image,
      audio,
      file
    });

    await newMessage.save();

    // Update conversation last message and lastMessageAt, and remove sender from deletedFor if present
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: message,
      lastMessageAt: newMessage.createdAt,
      $pull: { deletedFor: sender }
    });

    res.status(201).json({ message: 'Message sent', newMessage });
  } catch (error) {
    console.error('sendMessage error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all conversations for a user (excluding deleted)
exports.getUserConversations = async (req, res) => {
  try {
    const { companyId, userId } = req.query;

    if (!companyId || !userId) {
      return res.status(400).json({ message: 'companyId and userId are required' });
    }

    const conversations = await Conversation.find({
      companyId,
      participants: userId,
      deletedFor: { $ne: userId }
    }).sort({ lastMessageAt: -1 });

    res.json({ conversations });
  } catch (error) {
    console.error('getUser Conversations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get messages in a conversation with pagination
exports.getMessages = async (req, res) => {
  try {
    const { conversationId, page = 1, limit = 20 } = req.query;

    if (!conversationId) {
      return res.status(400).json({ message: 'conversationId is required' });
    }

    const skip = (page - 1) * limit;

    const messages = await Message.find({ conversationId })
      .sort({ createdAt: 1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit));

    res.json({ messages, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error('getMessages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Mark messages as viewed by a user
exports.markMessagesViewed = async (req, res) => {
  try {
    const { conversationId, userId } = req.body;

    if (!conversationId || !userId) {
      return res.status(400).json({ message: 'conversationId and userId are required' });
    }

    const result = await Message.updateMany(
      { conversationId, viewedBy: { $ne: userId } },
      { $addToSet: { viewedBy: userId } }
    );

    res.json({ message: 'Messages marked as viewed', modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error('markMessagesViewed error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Soft delete conversation for a user
exports.deleteConversationForUser  = async (req, res) => {
  try {
    const { conversationId, userId } = req.body;

    if (!conversationId || !userId) {
      return res.status(400).json({ message: 'conversationId and userId are required' });
    }

    await Conversation.findByIdAndUpdate(conversationId, {
      $addToSet: { deletedFor: userId }
    });

    res.json({ message: 'Conversation deleted for user' });
  } catch (error) {
    console.error('deleteConversationForUser  error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
