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
       SELECT text, created_at
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
