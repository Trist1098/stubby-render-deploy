const pool = require('./db');

module.exports.selectUserOwnedBadges = async function selectUserOwnedBadges(userId) {
  const SQLSTATEMENT = `
    SELECT b.* FROM badge b
    JOIN userbadge ub ON b.badge_id = ub.badge_id
    WHERE ub.user_id = $1
  `;
  const VALUES = [userId];
  const { rows } = await pool.query(SQLSTATEMENT, VALUES);
  return rows;
};