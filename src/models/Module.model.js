const pool = require('./db');

module.exports.selectAllModules = async function selectAllModules() {
    const SQLSTATEMENT = 'SELECT * FROM Module ORDER BY code ASC';
    const { rows } = await pool.query(SQLSTATEMENT);
    return rows;
};

module.exports.selectByDiploma = async function selectByDiploma(data) {
    const SQLSTATEMENT = 'SELECT * FROM Module WHERE diploma_id = $1 ORDER BY code ASC';
    const VALUES = [data.diploma_id];
    const { rows } = await pool.query(SQLSTATEMENT, VALUES);
    return rows;
};