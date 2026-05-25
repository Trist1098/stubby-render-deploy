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

module.exports.getFriendConversation = async (userId, friendId) => {
  const result = await pool.query(
    `SELECT cc.*
     FROM ChatConversation cc
     JOIN ConversationMember cm ON cm.conversation_id = cc.conversation_id
     WHERE cc.type = 'friend'
       AND cm.user_id IN ($1, $2)
     GROUP BY cc.conversation_id
     HAVING COUNT(DISTINCT cm.user_id) = 2
     ORDER BY cc.created_at ASC
     LIMIT 1`,
    [userId, friendId]
  );
  return result.rows[0] || null;
};

module.exports.ensureFriendConversation = async (userId, friendId, creatorId = userId) => {
  const existing = await module.exports.getFriendConversation(userId, friendId);
  if (existing) return existing;
  return module.exports.createConversation(null, 'friend', [userId, friendId], creatorId);
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
       cm.is_deleted,
       cm.created_at,
       cm.edited_at,
       cm.parent_message_id,
       pm.text          AS parent_text,
       pm.file_name     AS parent_file_name,
       pm.file_type     AS parent_file_type,
       pm.is_deleted    AS parent_is_deleted,
       pu.username      AS parent_sender_username,
       COALESCE(
         json_agg(
           json_build_object(
             'emoji', mr.emoji,
             'user_id', mr.user_id
           )
         ) FILTER (WHERE mr.reaction_id IS NOT NULL),
         '[]'
       ) AS reactions,
       (
         SELECT COUNT(*)::INT
         FROM MessageRead rd
         WHERE rd.message_id = cm.message_id
       ) AS read_by_count
     FROM ChatMessage cm
     JOIN "User" u ON u.user_id = cm.sender_id
     LEFT JOIN ChatMessage pm ON pm.message_id = cm.parent_message_id
     LEFT JOIN "User" pu ON pu.user_id = pm.sender_id
     LEFT JOIN MessageReaction mr ON mr.message_id = cm.message_id
     WHERE cm.conversation_id = $1
     GROUP BY cm.message_id, u.user_id, pm.message_id, pu.user_id
     ORDER BY cm.created_at DESC
     LIMIT $2 OFFSET $3`,
    [conversationId, limit, offset]
  );

  return result.rows.reverse();
};

module.exports.replyToMessage = async (conversationId, senderId, text, parentMessageId) => {
  const result = await pool.query(
    `INSERT INTO ChatMessage (conversation_id, sender_id, text, parent_message_id)
     VALUES ($1, $2, $3, $4)
     RETURNING message_id, conversation_id, sender_id, text, parent_message_id, is_announcement, created_at`,
    [conversationId, senderId, text, parentMessageId]
  );
  const message = result.rows[0];
  const [senderResult, parentResult] = await Promise.all([
    pool.query(`SELECT username FROM "User" WHERE user_id = $1`, [senderId]),
    pool.query(
      `SELECT cm.text, cm.file_name, cm.file_type, cm.is_deleted, u.username
       FROM ChatMessage cm
       JOIN "User" u ON u.user_id = cm.sender_id
       WHERE cm.message_id = $1`,
      [parentMessageId]
    ),
  ]);
  const parent = parentResult.rows[0];
  return {
    ...message,
    sender_username: senderResult.rows[0]?.username || 'Unknown user',
    parent_text: parent?.text || null,
    parent_file_name: parent?.file_name || null,
    parent_file_type: parent?.file_type || null,
    parent_is_deleted: parent?.is_deleted || false,
    parent_sender_username: parent?.username || null,
    reactions: [],
  };
};

module.exports.pinMessage = async (messageId, conversationId) => {
  const result = await pool.query(
    `INSERT INTO MessagePin (message_id, conversation_id)
     SELECT $1, $2
     FROM ChatMessage
     WHERE message_id = $1 AND conversation_id = $2 AND is_deleted = FALSE
     ON CONFLICT DO NOTHING
     RETURNING message_id`,
    [messageId, conversationId]
  );
  return result.rows[0] || null;
};

module.exports.unpinMessage = async (messageId, conversationId) => {
  const result = await pool.query(
    `DELETE FROM MessagePin
     WHERE message_id = $1 AND conversation_id = $2
     RETURNING message_id`,
    [messageId, conversationId]
  );
  return result.rows[0] || null;
};

module.exports.getPinnedMessages = async (conversationId) => {
  const result = await pool.query(
    `SELECT mp.message_id, mp.conversation_id, mp.pinned_at,
            cm.text, cm.file_url, cm.file_name, cm.file_type, cm.is_deleted,
            u.username AS sender_username
     FROM MessagePin mp
     JOIN ChatMessage cm ON cm.message_id = mp.message_id
     JOIN "User" u ON u.user_id = cm.sender_id
     WHERE mp.conversation_id = $1
     ORDER BY mp.pinned_at DESC`,
    [conversationId]
  );
  return result.rows;
};

module.exports.getMessageById = async (conversationId, messageId) => {
  const result = await pool.query(
    `SELECT message_id, conversation_id, is_deleted
     FROM ChatMessage
     WHERE conversation_id = $1 AND message_id = $2`,
    [conversationId, messageId]
  );
  return result.rows[0] || null;
};

module.exports.getMessageReactions = async (messageId) => {
  const result = await pool.query(
    `SELECT emoji, user_id
     FROM MessageReaction
     WHERE message_id = $1
     ORDER BY created_at`,
    [messageId]
  );
  return result.rows;
};

module.exports.addMessageReaction = async (messageId, userId, emoji) => {
  await pool.query(
    `INSERT INTO MessageReaction (message_id, user_id, emoji)
     VALUES ($1, $2, $3)
     ON CONFLICT (message_id, user_id, emoji) DO NOTHING`,
    [messageId, userId, emoji]
  );
  return module.exports.getMessageReactions(messageId);
};

module.exports.removeMessageReaction = async (messageId, userId, emoji) => {
  await pool.query(
    `DELETE FROM MessageReaction
     WHERE message_id = $1 AND user_id = $2 AND emoji = $3`,
    [messageId, userId, emoji]
  );
  return module.exports.getMessageReactions(messageId);
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

module.exports.deleteMessage = async (messageId, senderId) => {
  const result = await pool.query(
    `UPDATE ChatMessage
     SET is_deleted = TRUE
     WHERE message_id = $1 AND sender_id = $2
     RETURNING message_id`,
    [messageId, senderId]
  );
  return result.rows[0] || null;
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

module.exports.searchMessages = async (conversationId, { q, dateFrom, dateTo, senderId, type }) => {
  const conditions = ['cm.conversation_id = $1', 'cm.is_deleted = FALSE'];
  const values = [conversationId];
  let i = 2;

  if (q) {
    conditions.push(`cm.text ILIKE $${i++}`);
    values.push(`%${q}%`);
  }
  if (dateFrom) {
    conditions.push(`cm.created_at >= $${i++}::DATE`);
    values.push(dateFrom);
  }
  if (dateTo) {
    conditions.push(`cm.created_at < $${i++}::DATE + INTERVAL '1 day'`);
    values.push(dateTo);
  }
  if (senderId) {
    conditions.push(`cm.sender_id = $${i}`);
    values.push(Number(senderId));
  }
  if (type === 'text') {
    conditions.push('cm.file_url IS NULL');
  } else if (type === 'file') {
    conditions.push(`cm.file_url IS NOT NULL AND COALESCE(cm.file_type, '') NOT LIKE 'audio/%'`);
  } else if (type === 'voice') {
    conditions.push(`cm.file_type LIKE 'audio/%'`);
  }

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
       cm.created_at
     FROM ChatMessage cm
     JOIN "User" u ON u.user_id = cm.sender_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY cm.created_at DESC
     LIMIT 50`,
    values
  );

  return result.rows;
};

module.exports.searchConversations = async (userId, q) => {
  const result = await pool.query(
    `SELECT
       cc.conversation_id,
       cc.name,
       cc.type,
       cc.created_at,
       CASE WHEN cc.type = 'friend' THEN (
         SELECT u2.username
         FROM ConversationMember cm2
         JOIN "User" u2 ON u2.user_id = cm2.user_id
         WHERE cm2.conversation_id = cc.conversation_id AND cm2.user_id != $1
         LIMIT 1
       ) ELSE NULL END AS other_username
     FROM ChatConversation cc
     JOIN ConversationMember cm ON cm.conversation_id = cc.conversation_id
     WHERE cm.user_id = $1
       AND (
         cc.name ILIKE $2
         OR (cc.type = 'friend' AND EXISTS (
           SELECT 1 FROM ConversationMember cm3
           JOIN "User" u3 ON u3.user_id = cm3.user_id
           WHERE cm3.conversation_id = cc.conversation_id
             AND cm3.user_id != $1
             AND u3.username ILIKE $2
         ))
       )
     ORDER BY cc.created_at DESC`,
    [userId, `%${q}%`]
  );
  return result.rows;
};

module.exports.getMentionSuggestions = async (conversationId, q) => {
  const result = await pool.query(
    `SELECT u.user_id, u.username
     FROM ConversationMember cm
     JOIN "User" u ON u.user_id = cm.user_id
     WHERE cm.conversation_id = $1
       AND u.username ILIKE $2
     ORDER BY u.username
     LIMIT 10`,
    [conversationId, `%${q || ''}%`]
  );
  return result.rows;
};

module.exports.markConversationAsRead = async (conversationId, userId) => {
  await pool.query(
    `INSERT INTO MessageRead (message_id, user_id)
     SELECT message_id, $2
     FROM ChatMessage
     WHERE conversation_id = $1 AND sender_id != $2 AND is_deleted = FALSE
     ON CONFLICT DO NOTHING`,
    [conversationId, userId]
  );
};

module.exports.getMessageReadBy = async (messageId) => {
  const result = await pool.query(
    `SELECT u.user_id, u.username, mr.read_at
     FROM MessageRead mr
     JOIN "User" u ON u.user_id = mr.user_id
     WHERE mr.message_id = $1
     ORDER BY mr.read_at`,
    [messageId]
  );
  return result.rows;
};

module.exports.getMemberRole = async (conversationId, userId) => {
  const result = await pool.query(
    `SELECT role FROM ConversationMember WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, userId]
  );
  return result.rows[0]?.role || null;
};

module.exports.updateConversationName = async (conversationId, name) => {
  const result = await pool.query(
    `UPDATE ChatConversation SET name = $1 WHERE conversation_id = $2 RETURNING *`,
    [name, conversationId]
  );
  return result.rows[0] || null;
};

module.exports.addConversationMember = async (conversationId, userId) => {
  await pool.query(
    `INSERT INTO ConversationMember (conversation_id, user_id, role)
     VALUES ($1, $2, 'member')
     ON CONFLICT DO NOTHING`,
    [conversationId, userId]
  );
};

module.exports.removeConversationMember = async (conversationId, targetUserId) => {
  const result = await pool.query(
    `DELETE FROM ConversationMember
     WHERE conversation_id = $1 AND user_id = $2
     RETURNING user_id`,
    [conversationId, targetUserId]
  );
  return result.rows[0] || null;
};

module.exports.leaveConversation = async (conversationId, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const deleted = await client.query(
      `DELETE FROM ConversationMember WHERE conversation_id = $1 AND user_id = $2 RETURNING role`,
      [conversationId, userId]
    );
    if (deleted.rows[0]?.role === 'admin') {
      await client.query(
        `UPDATE ConversationMember SET role = 'admin'
         WHERE conversation_id = $1
           AND user_id = (
             SELECT user_id FROM ConversationMember
             WHERE conversation_id = $1
             ORDER BY joined_at
             LIMIT 1
           )
           AND NOT EXISTS (
             SELECT 1 FROM ConversationMember
             WHERE conversation_id = $1 AND role = 'admin'
           )`,
        [conversationId]
      );
    }
    await client.query('COMMIT');
    return deleted.rows[0] || null;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports.setTypingStatus = async (userId, conversationId, isTyping) => {
  await pool.query(
    `INSERT INTO UserPresence (user_id, typing_status, conversation_id, last_seen)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id) DO UPDATE
     SET typing_status = EXCLUDED.typing_status,
         conversation_id = EXCLUDED.conversation_id,
         last_seen = NOW()`,
    [userId, isTyping, isTyping ? conversationId : null]
  );
};

module.exports.getTypingUsers = async (conversationId, excludeUserId) => {
  const result = await pool.query(
    `SELECT u.user_id, u.username
     FROM UserPresence up
     JOIN "User" u ON u.user_id = up.user_id
     WHERE up.typing_status = TRUE
       AND up.conversation_id = $1
       AND up.user_id != $2
       AND up.last_seen >= NOW() - INTERVAL '5 seconds'`,
    [conversationId, excludeUserId]
  );
  return result.rows;
};
