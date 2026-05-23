const pool = require('./db');

module.exports.selectUserModules = async function selectUserModules(data) {
    const SQLSTATEMENT = `
        SELECT m.* 
        FROM UserModule um
        JOIN Module m ON um.module_id = m.module_id
        WHERE um.user_id = $1
    `;
    const VALUES = [data.user_id];
    const { rows } = await pool.query(SQLSTATEMENT, VALUES);
    return rows;
};
