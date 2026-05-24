const pool = require('./db');

module.exports.getByUserId = async function getByUserId(userId) {
  const SQLSTATEMENT = `
        SELECT experience_id,
               user_id,
               type,
               title,
               organization,
               start_date,
               end_date,
               description
        FROM ProfileExperience
        WHERE user_id = $1
        ORDER BY start_date DESC, experience_id DESC
    `;
  const { rows } = await pool.query(SQLSTATEMENT, [userId]);
  return rows;
};

module.exports.create = async function create(data) {
  const SQLSTATEMENT = `
        INSERT INTO ProfileExperience (user_id, type, title, organization, start_date, end_date, description)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
    `;
  const VALUES = [
    data.userId,
    data.type,
    data.title,
    data.organization,
    data.startDate,
    data.endDate || null,
    data.description || null,
  ];
  const { rows } = await pool.query(SQLSTATEMENT, VALUES);
  return rows[0];
};

module.exports.update = async function update(data) {
  const SQLSTATEMENT = `
        UPDATE ProfileExperience
        SET type = $1,
            title = $2,
            organization = $3,
            start_date = $4,
            end_date = $5,
            description = $6
        WHERE experience_id = $7 AND user_id = $8
        RETURNING *
    `;
  const VALUES = [
    data.type,
    data.title,
    data.organization,
    data.startDate,
    data.endDate || null,
    data.description || null,
    data.experienceId,
    data.userId,
  ];
  const { rows } = await pool.query(SQLSTATEMENT, VALUES);
  return rows[0];
};

module.exports.remove = async function remove(data) {
  const result = await pool.query(
    'DELETE FROM ProfileExperience WHERE experience_id = $1 AND user_id = $2',
    [data.experienceId, data.userId],
  );
  return result.rowCount;
};
