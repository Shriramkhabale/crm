const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

router.post('/conversation', chatController.getOrCreateConversation);
router.post('/message/send', chatController.sendMessage);
router.get('/conversations', chatController.getUserConversations);
router.get('/messages', chatController.getMessages);
router.post('/messages/mark-viewed', chatController.markMessagesViewed);
router.post('/conversation/delete', chatController.deleteConversationForUser );

module.exports = router;
