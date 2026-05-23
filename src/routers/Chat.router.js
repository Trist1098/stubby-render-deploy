const express = require('express');
const router = express.Router();
const jwtMiddleware = require('../middlewares/jwt.middleware');
const { uploadChatFile, uploadChatVoice } = require('../middlewares/chatUpload');
const {
  createConversation,
  getAllConversations,
  getConversationById,
  getFriends,
  sendMessage,
  getMessages,
  verifyUploadTarget,
  uploadFile,
  uploadVoiceMessage,
  deleteMessage,
  editMessage,
  addReaction,
  removeReaction,
  pinMessage,
  unpinMessage,
  getPinnedMessages,
  replyToMessage,
  setTypingStatus,
  getTypingUsers,
} = require('../controllers/Chat.controller');

// Get friends for the new chat modal
router.get('/friends', jwtMiddleware.verifyToken, getFriends);

// Conversation list and creation
router.get('/', jwtMiddleware.verifyToken, getAllConversations);
router.post('/', jwtMiddleware.verifyToken, createConversation);
router.put('/:conversationId/typing', jwtMiddleware.verifyToken, setTypingStatus);
router.get('/:conversationId/typing', jwtMiddleware.verifyToken, getTypingUsers);
router.get('/:conversationId/messages', jwtMiddleware.verifyToken, getMessages);
router.post('/:conversationId/messages', jwtMiddleware.verifyToken, sendMessage);
router.patch('/:conversationId/messages/:messageId', jwtMiddleware.verifyToken, editMessage);
router.delete('/:conversationId/messages/:messageId', jwtMiddleware.verifyToken, deleteMessage);
router.get('/:conversationId/pinned', jwtMiddleware.verifyToken, getPinnedMessages);
router.post('/:conversationId/messages/:messageId/pin', jwtMiddleware.verifyToken, pinMessage);
router.delete('/:conversationId/messages/:messageId/pin', jwtMiddleware.verifyToken, unpinMessage);
router.post('/:conversationId/messages/:messageId/reply', jwtMiddleware.verifyToken, replyToMessage);
router.post('/:conversationId/messages/:messageId/reactions/:emoji', jwtMiddleware.verifyToken, addReaction);
router.delete('/:conversationId/messages/:messageId/reactions/:emoji', jwtMiddleware.verifyToken, removeReaction);
router.post('/:conversationId/upload', jwtMiddleware.verifyToken, verifyUploadTarget, uploadChatFile, uploadFile);
router.post('/:conversationId/voice', jwtMiddleware.verifyToken, verifyUploadTarget, uploadChatVoice, uploadVoiceMessage);
router.get('/:conversationId', jwtMiddleware.verifyToken, getConversationById);

module.exports = router;
