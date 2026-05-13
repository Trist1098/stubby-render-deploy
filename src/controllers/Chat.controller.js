const { createConversation, getConversationsByUserId, getConversationById, checkFriendship, getFriends, isConversationMember, sendMessage, getMessagesByConversationId } = require('../models/Chat.model');

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
