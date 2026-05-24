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
  searchMessages,
  searchConversations,
  getMentionSuggestions,
  markAsRead,
  getReadBy,
  updateConversation,
  addMember,
  removeMember,
  leaveConversation,
} = require('../controllers/Chat.controller');

// Static routes
router.get('/friends', jwtMiddleware.verifyToken, getFriends);
router.get('/search', jwtMiddleware.verifyToken, searchConversations);

// Conversation list and creation
router.get('/', jwtMiddleware.verifyToken, getAllConversations);
router.post('/', jwtMiddleware.verifyToken, createConversation);

// Conversation actions
router.put('/:conversationId/typing', jwtMiddleware.verifyToken, setTypingStatus);
router.get('/:conversationId/typing', jwtMiddleware.verifyToken, getTypingUsers);
router.patch('/:conversationId/read', jwtMiddleware.verifyToken, markAsRead);
router.get('/:conversationId/pinned', jwtMiddleware.verifyToken, getPinnedMessages);
router.get('/:conversationId/search', jwtMiddleware.verifyToken, searchMessages);
router.get('/:conversationId/mentions', jwtMiddleware.verifyToken, getMentionSuggestions);
router.post('/:conversationId/members', jwtMiddleware.verifyToken, addMember);
router.delete('/:conversationId/members/:userId', jwtMiddleware.verifyToken, removeMember);
router.delete('/:conversationId/leave', jwtMiddleware.verifyToken, leaveConversation);

// Message actions
router.get('/:conversationId/messages', jwtMiddleware.verifyToken, getMessages);
router.post('/:conversationId/messages', jwtMiddleware.verifyToken, sendMessage);
router.patch('/:conversationId/messages/:messageId', jwtMiddleware.verifyToken, editMessage);
router.delete('/:conversationId/messages/:messageId', jwtMiddleware.verifyToken, deleteMessage);
router.post('/:conversationId/messages/:messageId/pin', jwtMiddleware.verifyToken, pinMessage);
router.delete('/:conversationId/messages/:messageId/pin', jwtMiddleware.verifyToken, unpinMessage);
router.post('/:conversationId/messages/:messageId/reply', jwtMiddleware.verifyToken, replyToMessage);
router.post('/:conversationId/messages/:messageId/reactions/:emoji', jwtMiddleware.verifyToken, addReaction);
router.delete('/:conversationId/messages/:messageId/reactions/:emoji', jwtMiddleware.verifyToken, removeReaction);
router.get('/:conversationId/messages/:messageId/readBy', jwtMiddleware.verifyToken, getReadBy);

// Uploads
router.post('/:conversationId/upload', jwtMiddleware.verifyToken, verifyUploadTarget, uploadChatFile, uploadFile);
router.post('/:conversationId/voice', jwtMiddleware.verifyToken, verifyUploadTarget, uploadChatVoice, uploadVoiceMessage);

// Conversation update
router.patch('/:conversationId', jwtMiddleware.verifyToken, updateConversation);
router.get('/:conversationId', jwtMiddleware.verifyToken, getConversationById);

module.exports = router;
