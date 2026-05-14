const express = require('express');
const router = express.Router();
const jwtMiddleware = require('../middlewares/jwt.middleware');
const { uploadChatFile } = require('../middlewares/chatUpload');
const { createConversation, getAllConversations, getConversationById, getFriends, sendMessage, getMessages, verifyUploadTarget, uploadFile } = require('../controllers/Chat.controller');

// Get friends for the new chat modal
router.get('/friends', jwtMiddleware.verifyToken, getFriends);

// Conversation list and creation
router.get('/', jwtMiddleware.verifyToken, getAllConversations);
router.post('/', jwtMiddleware.verifyToken, createConversation);
router.get('/:conversationId/messages', jwtMiddleware.verifyToken, getMessages);
router.post('/:conversationId/messages', jwtMiddleware.verifyToken, sendMessage);
router.post('/:conversationId/upload', jwtMiddleware.verifyToken, verifyUploadTarget, uploadChatFile, uploadFile);
router.get('/:conversationId', jwtMiddleware.verifyToken, getConversationById);

module.exports = router;
