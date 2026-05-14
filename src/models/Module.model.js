const pool = require('./db');

module.exports.selectAllModules = async function selectAllModules() {
    const SQLSTATEMENT = 'SELECT * FROM Module ORDER BY code ASC';
    const { rows } = await pool.query(SQLSTATEMENT);
    return rows;
};