const {
  createConversation,
  getConversationsByUserId,
  getConversationById,
  checkFriendship,
  getFriends,
  isConversationMember,
  sendMessage,
  getMessagesByConversationId,
  pinMessage: pinMessageModel,
  unpinMessage: unpinMessageModel,
  getPinnedMessages: getPinnedMessagesModel,
  getMessageById,
  addMessageReaction,
  removeMessageReaction,
  deleteMessage: deleteMessageModel,
  editMessage: editMessageModel,
  uploadFile: uploadFileModel,
  uploadVoiceMessage: uploadVoiceMessageModel,
  replyToMessage: replyToMessageModel,
  setTypingStatus: setTypingStatusModel,
  getTypingUsers: getTypingUsersModel,
  searchMessages: searchMessagesModel,
} = require('../models/Chat.model');

module.exports.verifyUploadTarget = async (req, res, next) => {
  const userId = res.locals.userId;
  const conversationId = Number(req.params.conversationId);

  if (!Number.isInteger(conversationId)) {
    return res.status(400).json({ message: 'Invalid conversation id' });
  }

  try {
    const isMember = await isConversationMember(conversationId, userId);
    if (!isMember) {
      return res.status(403).json({ message: 'You are not a member of this conversation' });
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports.createConversation = async (req, res, next) => {
  const { type, name, friendId, memberIds } = req.body;
  const userId = res.locals.userId;

  if (!type || !['friend', 'group'].includes(type)) {
    return res.status(400).json({ message: 'type must be "friend" or "group"' });
  }

  try {
    if (type === 'friend') {
      if (!friendId) {
        return res.status(400).json({ message: 'friendId is required for 1-to-1 chat' });
      }
      const areFriends = await checkFriendship(userId, Number(friendId));
      if (!areFriends) {
        return res.status(403).json({ message: 'You are not friends with this user' });
      }
      const conv = await createConversation(null, 'friend', [userId, Number(friendId)], userId);
      return res.status(201).json(conv);
    }

    if (type === 'group') {
      if (!name || !name.trim()) {
        return res.status(400).json({ message: 'name is required for group chat' });
      }
      if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
        return res.status(400).json({ message: 'memberIds array is required for group chat' });
      }
      const allMembers = [userId, ...memberIds.map(Number).filter(id => id !== userId)];
      const conv = await createConversation(name.trim(), 'group', allMembers, userId);
      return res.status(201).json(conv);
    }
  } catch (error) {
    next(error);
  }
};

module.exports.getConversationById = async (req, res, next) => {
  const { conversationId } = req.params;
  try {
    const conv = await getConversationById(conversationId);
    if (!conv) return res.status(404).json({ message: 'Conversation not found' });
    res.json(conv);
  } catch (error) {
    next(error);
  }
};

module.exports.getAllConversations = async (req, res, next) => {
  const userId = res.locals.userId;
  try {
    const conversations = await getConversationsByUserId(userId);
    res.json(conversations);
  } catch (error) {
    next(error);
  }
};

module.exports.getFriends = async (req, res, next) => {
  const userId = res.locals.userId;
  try {
    const friends = await getFriends(userId);
    res.json(friends);
  } catch (error) {
    next(error);
  }
};

module.exports.sendMessage = async (req, res, next) => {
  const userId = res.locals.userId;
  const conversationId = Number(req.params.conversationId);
  const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';

  if (!Number.isInteger(conversationId)) {
    return res.status(400).json({ message: 'Invalid conversation id' });
  }

  if (!text) {
    return res.status(400).json({ message: 'Message cannot be empty' });
  }

  try {
    const isMember = await isConversationMember(conversationId, userId);
    if (!isMember) {
      return res.status(403).json({ message: 'You are not a member of this conversation' });
    }

    const message = await sendMessage(conversationId, userId, text);
    res.status(201).json(message);
  } catch (error) {
    next(error);
  }
};

module.exports.getMessages = async (req, res, next) => {
  const userId = res.locals.userId;
  const conversationId = Number(req.params.conversationId);
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  if (!Number.isInteger(conversationId)) {
    return res.status(400).json({ message: 'Invalid conversation id' });
  }

  try {
    const isMember = await isConversationMember(conversationId, userId);
    if (!isMember) {
      return res.status(403).json({ message: 'You are not a member of this conversation' });
    }

    const messages = await getMessagesByConversationId(conversationId, limit, offset);
    res.json(messages);
  } catch (error) {
    next(error);
  }
};

module.exports.getPinnedMessages = async (req, res, next) => {
  const userId = res.locals.userId;
  const conversationId = Number(req.params.conversationId);
  if (!Number.isInteger(conversationId)) return res.status(400).json({ message: 'Invalid id' });
  try {
    const isMember = await isConversationMember(conversationId, userId);
    if (!isMember) return res.status(403).json({ message: 'You are not a member of this conversation' });
    const pins = await getPinnedMessagesModel(conversationId);
    res.json(pins);
  } catch (error) {
    next(error);
  }
};

module.exports.pinMessage = async (req, res, next) => {
  const userId = res.locals.userId;
  const conversationId = Number(req.params.conversationId);
  const messageId = Number(req.params.messageId);
  if (!Number.isInteger(conversationId) || !Number.isInteger(messageId)) return res.status(400).json({ message: 'Invalid id' });
  try {
    const isMember = await isConversationMember(conversationId, userId);
    if (!isMember) return res.status(403).json({ message: 'You are not a member of this conversation' });
    const pin = await pinMessageModel(messageId, conversationId);
    if (!pin) return res.status(404).json({ message: 'Message not found or already pinned' });
    const pins = await getPinnedMessagesModel(conversationId);
    res.status(201).json(pins);
  } catch (error) {
    next(error);
  }
};

module.exports.unpinMessage = async (req, res, next) => {
  const userId = res.locals.userId;
  const conversationId = Number(req.params.conversationId);
  const messageId = Number(req.params.messageId);
  if (!Number.isInteger(conversationId) || !Number.isInteger(messageId)) return res.status(400).json({ message: 'Invalid id' });
  try {
    const isMember = await isConversationMember(conversationId, userId);
    if (!isMember) return res.status(403).json({ message: 'You are not a member of this conversation' });
    const unpinned = await unpinMessageModel(messageId, conversationId);
    if (!unpinned) return res.status(404).json({ message: 'Pin not found' });
    const pins = await getPinnedMessagesModel(conversationId);
    res.json(pins);
  } catch (error) {
    next(error);
  }
};

async function checkReactionTarget(conversationId, messageId, userId) {
  if (!Number.isInteger(conversationId) || !Number.isInteger(messageId)) {
    return { status: 400, message: 'Invalid id' };
  }

  const isMember = await isConversationMember(conversationId, userId);
  if (!isMember) {
    return { status: 403, message: 'You are not a member of this conversation' };
  }

  const message = await getMessageById(conversationId, messageId);
  if (!message || message.is_deleted) {
    return { status: 404, message: 'Message not found' };
  }

  return null;
}

module.exports.addReaction = async (req, res, next) => {
  const userId = res.locals.userId;
  const conversationId = Number(req.params.conversationId);
  const messageId = Number(req.params.messageId);
  const emoji = String(req.params.emoji || '').trim();

  if (!emoji || emoji.length > 20) {
    return res.status(400).json({ message: 'Invalid emoji' });
  }

  try {
    const targetError = await checkReactionTarget(conversationId, messageId, userId);
    if (targetError) return res.status(targetError.status).json({ message: targetError.message });

    const reactions = await addMessageReaction(messageId, userId, emoji);
    res.status(201).json({ message_id: messageId, reactions });
  } catch (error) {
    next(error);
  }
};

module.exports.removeReaction = async (req, res, next) => {
  const userId = res.locals.userId;
  const conversationId = Number(req.params.conversationId);
  const messageId = Number(req.params.messageId);
  const emoji = String(req.params.emoji || '').trim();

  if (!emoji || emoji.length > 20) {
    return res.status(400).json({ message: 'Invalid emoji' });
  }

  try {
    const targetError = await checkReactionTarget(conversationId, messageId, userId);
    if (targetError) return res.status(targetError.status).json({ message: targetError.message });

    const reactions = await removeMessageReaction(messageId, userId, emoji);
    res.json({ message_id: messageId, reactions });
  } catch (error) {
    next(error);
  }
};

module.exports.deleteMessage = async (req, res, next) => {
  const userId = res.locals.userId;
  const conversationId = Number(req.params.conversationId);
  const messageId = Number(req.params.messageId);

  if (!Number.isInteger(conversationId) || !Number.isInteger(messageId)) {
    return res.status(400).json({ message: 'Invalid id' });
  }

  try {
    const deleted = await deleteMessageModel(messageId, userId);
    if (!deleted) return res.status(404).json({ message: 'Message not found or not yours' });
    res.json({ message_id: messageId });
  } catch (error) {
    next(error);
  }
};

module.exports.editMessage = async (req, res, next) => {
  const userId = res.locals.userId;
  const conversationId = Number(req.params.conversationId);
  const messageId = Number(req.params.messageId);
  const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';

  if (!Number.isInteger(conversationId) || !Number.isInteger(messageId)) {
    return res.status(400).json({ message: 'Invalid id' });
  }
  if (!text) {
    return res.status(400).json({ message: 'Message cannot be empty' });
  }

  try {
    const updated = await editMessageModel(messageId, userId, text);
    if (!updated) return res.status(404).json({ message: 'Message not found or not yours' });
    res.json(updated);
  } catch (error) {
    next(error);
  }
};

module.exports.uploadVoiceMessage = async (req, res, next) => {
  if (!req.file) return res.status(400).json({ message: 'No audio file uploaded' });

  const userId = res.locals.userId;
  const conversationId = Number(req.params.conversationId);
  const duration = req.body.duration ? Math.round(Number(req.body.duration)) : null;

  try {
    const fileUrl = '/uploads/' + req.file.filename;
    const message = await uploadVoiceMessageModel(
      conversationId,
      userId,
      fileUrl,
      req.file.mimetype,
      duration,
    );
    res.status(201).json(message);
  } catch (error) {
    next(error);
  }
};

module.exports.uploadFile = async (req, res, next) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  const userId = res.locals.userId;
  const conversationId = Number(req.params.conversationId);

  try {
    const fileUrl = '/uploads/' + req.file.filename;
    const message = await uploadFileModel(
      conversationId,
      userId,
      fileUrl,
      req.file.mimetype,
      req.file.originalname,
      req.file.size,
    );
    res.status(201).json(message);
  } catch (error) {
    next(error);
  }
};

module.exports.replyToMessage = async (req, res, next) => {
  const userId = res.locals.userId;
  const conversationId = Number(req.params.conversationId);
  const parentMessageId = Number(req.params.messageId);
  const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';

  if (!Number.isInteger(conversationId) || !Number.isInteger(parentMessageId)) {
    return res.status(400).json({ message: 'Invalid id' });
  }
  if (!text) {
    return res.status(400).json({ message: 'Message cannot be empty' });
  }

  try {
    const isMember = await isConversationMember(conversationId, userId);
    if (!isMember) return res.status(403).json({ message: 'You are not a member of this conversation' });

    const parent = await getMessageById(conversationId, parentMessageId);
    if (!parent) return res.status(404).json({ message: 'Message not found' });

    const message = await replyToMessageModel(conversationId, userId, text, parentMessageId);
    res.status(201).json(message);
  } catch (error) {
    next(error);
  }
};

module.exports.setTypingStatus = async (req, res, next) => {
  const userId = res.locals.userId;
  const conversationId = Number(req.params.conversationId);
  const isTyping = Boolean(req.body.typing);

  if (!Number.isInteger(conversationId)) {
    return res.status(400).json({ message: 'Invalid conversation id' });
  }

  try {
    const isMember = await isConversationMember(conversationId, userId);
    if (!isMember) return res.status(403).json({ message: 'You are not a member of this conversation' });

    await setTypingStatusModel(userId, conversationId, isTyping);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

module.exports.searchMessages = async (req, res, next) => {
  const userId = res.locals.userId;
  const conversationId = Number(req.params.conversationId);
  const { q, dateFrom, dateTo, senderId, type } = req.query;

  if (!Number.isInteger(conversationId)) {
    return res.status(400).json({ message: 'Invalid conversation id' });
  }

  try {
    const isMember = await isConversationMember(conversationId, userId);
    if (!isMember) return res.status(403).json({ message: 'You are not a member of this conversation' });

    const results = await searchMessagesModel(conversationId, { q, dateFrom, dateTo, senderId, type });
    res.json(results);
  } catch (error) {
    next(error);
  }
};

module.exports.getTypingUsers = async (req, res, next) => {
  const userId = res.locals.userId;
  const conversationId = Number(req.params.conversationId);

  if (!Number.isInteger(conversationId)) {
    return res.status(400).json({ message: 'Invalid conversation id' });
  }

  try {
    const isMember = await isConversationMember(conversationId, userId);
    if (!isMember) return res.status(403).json({ message: 'You are not a member of this conversation' });

    const typingUsers = await getTypingUsersModel(conversationId, userId);
    res.json(typingUsers);
  } catch (error) {
    next(error);
  }
};
