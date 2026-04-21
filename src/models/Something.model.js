const pool = require('./db');

module.exports.createSomething = async function createSomething(name) {
  const { rows } = await pool.query('INSERT INTO "Something" ("name") VALUES ($1) RETURNING *', [
    name,
  ]);
  return rows[0];
};

module.exports.getAllSomethings = async function getAllSomethings() {
  const { rows } = await pool.query('SELECT * FROM "Something"');
  return rows;
};

module.exports.updateSomething = async function updateSomething(id, data) {
  const { rows } = await pool.query(
    'UPDATE "Something" SET "name" = $1 WHERE "id" = $2 RETURNING *',
    [data.name, id],
  );
  return rows[0];
};

module.exports.deleteSomething = async function deleteSomething(id) {
  const { rows } = await pool.query('DELETE FROM "Something" WHERE "id" = $1 RETURNING *', [id]);
  return rows[0];
};
