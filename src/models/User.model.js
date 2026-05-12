const pool = require('./db');

module.exports.selectByUsernameOrEmail = async function selectByUsernameOrEmail(data) {
    const SQLSTATEMENT = `
        SELECT * 
        FROM "User" 
        WHERE username = $1 OR email = $2
    `;
    const VALUES = [data.identifier, data.identifier];
    const { rows } = await pool.query(SQLSTATEMENT, VALUES);
    return rows;
};