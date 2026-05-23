const pool = require('./db');

module.exports.createFriendRequest = async function ({ senderId, receiverId }) {
  const SQLSTATEMENT = `
    INSERT INTO FriendRequest ("sender_id", "receiver_id")
    VALUES ($1, $2)
    ON CONFLICT ("sender_id", "receiver_id") DO NOTHING
    RETURNING request_id, sender_id, receiver_id, created_at
  `;
  const VALUES = [senderId, receiverId];
  const { rows } = await pool.query(SQLSTATEMENT, VALUES);
  return rows[0] || null;
};

module.exports.getFriendRequestById = async function (requestId) {
  const SQLSTATEMENT = `
    SELECT request_id, sender_id, receiver_id, created_at
    FROM FriendRequest
    WHERE request_id = $1
  `;
  const VALUES = [requestId];
  const { rows } = await pool.query(SQLSTATEMENT, VALUES);
  return rows[0] || null;
};

module.exports.getFriendRequestBetweenUsers = async function ({ senderId, receiverId }) {
  const SQLSTATEMENT = `
    SELECT request_id, sender_id, receiver_id, created_at
    FROM FriendRequest
    WHERE (sender_id = $1 AND receiver_id = $2)
       OR (sender_id = $2 AND receiver_id = $1)
  `;
  const VALUES = [senderId, receiverId];
  const { rows } = await pool.query(SQLSTATEMENT, VALUES);
  return rows[0] || null;
};

module.exports.deleteFriendRequestById = async function (requestId) {
  const SQLSTATEMENT = `
    DELETE FROM FriendRequest
    WHERE request_id = $1
  `;
  const VALUES = [requestId];
  const result = await pool.query(SQLSTATEMENT, VALUES);
  return result.rowCount;
};

module.exports.getIncomingRequests = async function (userId) {
  const SQLSTATEMENT = `
    SELECT fr.request_id,
           fr.sender_id,
           fr.receiver_id,
           fr.created_at,
           u.username AS sender_username,
           u.name AS sender_name,
           u.profile_pic AS sender_profile_pic
    FROM FriendRequest fr
    JOIN "User" u ON u.user_id = fr.sender_id
    WHERE fr.receiver_id = $1
    ORDER BY fr.created_at DESC
  `;
  const VALUES = [userId];
  const { rows } = await pool.query(SQLSTATEMENT, VALUES);
  return rows;
};

module.exports.getOutgoingRequests = async function (userId) {
  const SQLSTATEMENT = `
    SELECT fr.request_id,
           fr.sender_id,
           fr.receiver_id,
           fr.created_at,
           u.username AS receiver_username,
           u.name AS receiver_name,
           u.profile_pic AS receiver_profile_pic
    FROM FriendRequest fr
    JOIN "User" u ON u.user_id = fr.receiver_id
    WHERE fr.sender_id = $1
    ORDER BY fr.created_at DESC
  `;
  const VALUES = [userId];
  const { rows } = await pool.query(SQLSTATEMENT, VALUES);
  return rows;
};
