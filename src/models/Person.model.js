const pool = require('./db');

module.exports.getAllPersons = async function getAllPersons() {
  const { rows } = await pool.query('SELECT * FROM "Person"');
  return rows;
};
