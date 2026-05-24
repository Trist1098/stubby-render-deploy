const pool = require('./db');

module.exports.getFriendsForUser = async function getFriendsForUser(userId) {
  const SQLSTATEMENT = `
        SELECT f.friendship_id,
               f.created_at,
               u.user_id AS friend_id,
               u.username,
               u.name,
               u.profile_pic
        FROM Friendship f
        JOIN "User" u ON u.user_id = f.friend_id
        WHERE f.user_id = $1
        ORDER BY f.created_at DESC, f.friendship_id DESC
    `;
  const VALUES = [userId];
  const { rows } = await pool.query(SQLSTATEMENT, VALUES);
  return rows;
};

module.exports.deleteFriendship = async function deleteFriendship(data) {
  const SQLSTATEMENT = `
        DELETE FROM Friendship
        WHERE (user_id = $1 AND friend_id = $2)
           OR (user_id = $2 AND friend_id = $1)
    `;
  const VALUES = [data.userId, data.friendId];
  const result = await pool.query(SQLSTATEMENT, VALUES);
  return result.rowCount;
};

module.exports.createFriendship = async function createFriendship(data) {
  const SQLSTATEMENT = `
        INSERT INTO Friendship (user_id, friend_id)
        VALUES ($1, $2)
        ON CONFLICT (user_id, friend_id) DO NOTHING
        RETURNING friendship_id, user_id, friend_id
    `;
  const VALUES = [data.userId, data.friendId];
  const { rows } = await pool.query(SQLSTATEMENT, VALUES);
  return rows[0] || null;
};
