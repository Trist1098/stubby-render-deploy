const pool = require('./db');

module.exports.getDiplomaByDiplomaId = async function selectDiplomaByDiplomaId(diplomaId) {
  const SQLSTATEMENT = `
    SELECT * FROM Diploma
    WHERE diploma_id = $1
  `;
  const VALUES = [diplomaId];
  const { rows } = await pool.query(SQLSTATEMENT, VALUES);
  return rows;
};

module.exports.updateDiplomaByDiplomaId = async function updateDiplomaByDiplomaId(data) {
  const SQLSTATEMENT = `
    UPDATE "User"
    SET diploma_id = $1
    WHERE user_id = $2
  `;
  const VALUES = [data.diplomaId, data.userId];
  const { rows } = await pool.query(SQLSTATEMENT, VALUES);
  return rows[0] || null;
}
