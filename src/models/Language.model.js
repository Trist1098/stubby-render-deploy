const pool = require('./db');

module.exports.selectAllLanguages = async function selectAllLanguages() {
    const SQLSTATEMENT = 'SELECT * FROM Language ORDER BY name ASC';
    const { rows } = await pool.query(SQLSTATEMENT);
    return rows;
};
