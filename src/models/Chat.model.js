const pool = require('./db');

module.exports.createConversation = async (name, type, memberIds, creatorId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const convResult = await client.query(
      'INSERT INTO ChatConversation (name, type) VALUES ($1, $2) RETURNING *',
      [name, type]
    );
    const conv = convResult.rows[0];
    for (const userId of memberIds) {
      const role = userId === creatorId ? 'admin' : 'member';
      await client.query(
        'INSERT INTO ConversationMember (conversation_id, user_id, role) VALUES ($1, $2, $3)',
        [conv.conversation_id, userId, role]
      );
    }
    await client.query('COMMIT');
    return conv;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports.getConversationById = async (conversationId) => {
  const convResult = await pool.query(
    'SELECT * FROM ChatConversation WHERE conversation_id = $1',
    [conversationId]
  );
  if (convResult.rows.length === 0) return null;
  const membersResult = await pool.query(
    `SELECT cm.user_id, cm.role, cm.joined_at, u.username
     FROM ConversationMember cm
     JOIN "User" u ON u.user_id = cm.user_id
     WHERE cm.conversation_id = $1`,
    [conversationId]
  );
  return { ...convResult.rows[0], members: membersResult.rows };
};

module.exports.checkFriendship = async (userId, friendId) => {
  const result = await pool.query(
    'SELECT 1 FROM Friendship WHERE user_id = $1 AND friend_id = $2',
    [userId, friendId]
  );
  return result.rows.length > 0;
};

module.exports.getConversationsByUserId = async (userId) => {
  const result = await pool.query(
    `SELECT
       cc.conversation_id,
       cc.name,
       cc.type,
       cc.created_at,
       lm.text       AS last_message,
       lm.created_at AS last_message_at,
       CASE WHEN cc.type = 'friend' THEN (
         SELECT u.username
         FROM ConversationMember cm2
         JOIN "User" u ON u.user_id = cm2.user_id
         WHERE cm2.conversation_id = cc.conversation_id AND cm2.user_id != $1
         LIMIT 1
       ) ELSE NULL END AS other_username
     FROM ChatConversation cc
     JOIN ConversationMember cm ON cm.conversation_id = cc.conversation_id
     LEFT JOIN LATERAL (
       SELECT COALESCE(text, file_name, 'File') AS text, created_at
       FROM ChatMessage
       WHERE conversation_id = cc.conversation_id
       ORDER BY created_at DESC
       LIMIT 1
     ) lm ON true
     WHERE cm.user_id = $1
     ORDER BY COALESCE(lm.created_at, cc.created_at) DESC`,
    [userId]
  );
  return result.rows;
};

module.exports.getFriends = async (userId) => {
  const result = await pool.query(
    `SELECT u.user_id, u.username
     FROM Friendship f
     JOIN "User" u ON u.user_id = f.friend_id
     WHERE f.user_id = $1
     ORDER BY u.username`,
    [userId]
  );
  return result.rows;
};

module.exports.isConversationMember = async (conversationId, userId) => {
  const result = await pool.query(
    `SELECT 1
     FROM ConversationMember
     WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, userId]
  );
  return result.rows.length > 0;
};

module.exports.sendMessage = async (conversationId, senderId, text) => {
  const result = await pool.query(
    `INSERT INTO ChatMessage (conversation_id, sender_id, text)
     VALUES ($1, $2, $3)
     RETURNING message_id, conversation_id, sender_id, text, is_announcement, created_at`,
    [conversationId, senderId, text]
  );

  const message = result.rows[0];
  const senderResult = await pool.query(
    `SELECT username
     FROM "User"
     WHERE user_id = $1`,
    [senderId]
  );

  return {
    ...message,
    sender_username: senderResult.rows[0]?.username || 'Unknown user',
  };
};

module.exports.getMessagesByConversationId = async (conversationId, limit = 50, offset = 0) => {
  const result = await pool.query(
    `SELECT
       cm.message_id,
       cm.conversation_id,
       cm.sender_id,
       u.username AS sender_username,
       cm.text,
       cm.file_url,
       cm.file_type,
       cm.file_name,
       cm.file_size,
       cm.duration,
       cm.is_announcement,
       cm.created_at,
       cm.edited_at
     FROM ChatMessage cm
     JOIN "User" u ON u.user_id = cm.sender_id
     WHERE cm.conversation_id = $1
     ORDER BY cm.created_at DESC
     LIMIT $2 OFFSET $3`,
    [conversationId, limit, offset]
  );

  return result.rows.reverse();
};

module.exports.uploadVoiceMessage = async (conversationId, senderId, fileUrl, fileType, duration) => {
  const result = await pool.query(
    `INSERT INTO ChatMessage (conversation_id, sender_id, file_url, file_type, duration)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING message_id, conversation_id, sender_id, text, file_url, file_type, file_name, file_size, duration, is_announcement, created_at`,
    [conversationId, senderId, fileUrl, fileType, duration || null]
  );
  const message = result.rows[0];
  const senderResult = await pool.query(
    `SELECT username FROM "User" WHERE user_id = $1`,
    [senderId]
  );
  return { ...message, sender_username: senderResult.rows[0]?.username || 'Unknown user' };
};

module.exports.editMessage = async (messageId, senderId, text) => {
  const result = await pool.query(
    `UPDATE ChatMessage
     SET text = $1, edited_at = NOW()
     WHERE message_id = $2 AND sender_id = $3
     RETURNING message_id, conversation_id, sender_id, text, file_url, file_type, file_name, file_size, duration, is_announcement, created_at, edited_at`,
    [text, messageId, senderId]
  );
  return result.rows[0] || null;
};

module.exports.uploadFile = async (conversationId, senderId, fileUrl, fileType, fileName, fileSize) => {
  const result = await pool.query(
    `INSERT INTO ChatMessage (conversation_id, sender_id, file_url, file_type, file_name, file_size)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING message_id, conversation_id, sender_id, text, file_url, file_type, file_name, file_size, is_announcement, created_at`,
    [conversationId, senderId, fileUrl, fileType, fileName, fileSize]
  );
  const message = result.rows[0];
  const senderResult = await pool.query(
    `SELECT username FROM "User" WHERE user_id = $1`,
    [senderId]
  );
  return { ...message, sender_username: senderResult.rows[0]?.username || 'Unknown user' };
};
