//routes/chatRoutes.js

const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

router.post('/conversation', chatController.createConversation);
router.post('/message/send', chatController.sendMessage);
router.get('/messages', chatController.getMessages);
router.post('/messages/mark-viewed', chatController.markMessageViewed);
router.post('/conversation/delete', chatController.deleteMessage);

module.exports = router;