const pool = require('./db');

module.exports.selectUserOwnedBadges = async function selectUserOwnedBadges(userId) {
  const SQLSTATEMENT = `
    SELECT
      b.*,
      ub.is_selected,
      ub.awarded_at
    FROM badge b
    JOIN userbadge ub ON b.badge_id = ub.badge_id
    WHERE ub.user_id = $1
    ORDER BY ub.is_selected DESC, ub.awarded_at DESC, b.name ASC
  `;
  const VALUES = [userId];
  const { rows } = await pool.query(SQLSTATEMENT, VALUES);
  return rows;
};
