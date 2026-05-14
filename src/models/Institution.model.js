const pool = require('./db');

module.exports.getInstitutionByInstitutionId = async function selectInstitutionByInstitutionId(institutionId) {
  const SQLSTATEMENT = `
    SELECT * FROM Institution
    WHERE institution_id = $1
  `;
  const VALUES = [institutionId];
  const { rows } = await pool.query(SQLSTATEMENT, VALUES);
  return rows;
};

module.exports.updateInstitutionByInstitutionId = async function updateInstitutionByInstitutionId(data) {
  const SQLSTATEMENT = `
    UPDATE "User"
    SET institution_id = $1
    WHERE user_id = $2
  `;
  const VALUES = [data.institutionId, data.userId];
  const { rows } = await pool.query(SQLSTATEMENT, VALUES);
  return rows[0] || null;
}
