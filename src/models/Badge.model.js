const pool = require('./db');

module.exports.selectAllBadges = async function selectAllBadges() {
  const SQLSTATEMENT = `
    SELECT * FROM Badge
    ORDER BY category ASC, name ASC
  `;
  const { rows } = await pool.query(SQLSTATEMENT);
  return rows;
};
