const pool = require('./db');

module.exports.selectAllByUser = async function selectAllByUser(data) {
    const SQLSTATEMENT = `
        SELECT mr.*, u1.name as sender_name, u2.name as receiver_name 
        FROM MatchRequest mr
        JOIN "User" u1 ON mr.sender_id = u1.user_id
        JOIN "User" u2 ON mr.receiver_id = u2.user_id
        WHERE mr.sender_id = $1 OR mr.receiver_id = $2
        ORDER BY mr.created_at DESC
    `;
    const VALUES = [data.user_id, data.user_id];
    const { rows } = await pool.query(SQLSTATEMENT, VALUES);
    return rows;
};

module.exports.selectBySender = async function selectBySender(data) {
    const SQLSTATEMENT = `
        SELECT mr.*, u.name as receiver_name, u.username as receiver_username, u.profile_pic as receiver_pic,
            m.code as module_code, m.name as module_name,
            count(*) OVER() AS total_count,
            SUM(CASE WHEN mr.status = 'Pending' THEN 1 ELSE 0 END) OVER() AS pending_count
        FROM MatchRequest mr
        JOIN "User" u ON mr.receiver_id = u.user_id
        LEFT JOIN Module m ON mr.module_id = m.module_id
        WHERE mr.sender_id = $1 
        ORDER BY 
            CASE 
                WHEN mr.status = 'Pending' THEN 1
                WHEN mr.status = 'Accepted' THEN 2
                ELSE 3
            END ASC,
            mr.request_id DESC
        LIMIT $2 OFFSET $3
    `;
    const VALUES = [data.sender_id, data.limit || 6, data.offset || 0];
    const { rows } = await pool.query(SQLSTATEMENT, VALUES);
    return rows;
};

module.exports.selectByReceiver = async function selectByReceiver(data) {
    const SQLSTATEMENT = `
        SELECT mr.*, u.name as sender_name, u.username as sender_username, u.profile_pic as sender_pic,
            m.code as module_code, m.name as module_name,
            count(*) OVER() AS total_count,
            SUM(CASE WHEN mr.status = 'Pending' THEN 1 ELSE 0 END) OVER() AS pending_count
        FROM MatchRequest mr
        JOIN "User" u ON mr.sender_id = u.user_id
        LEFT JOIN Module m ON mr.module_id = m.module_id
        WHERE mr.receiver_id = $1 
        ORDER BY 
            CASE 
                WHEN mr.status = 'Pending' THEN 1
                WHEN mr.status = 'Accepted' THEN 2
                ELSE 3
            END ASC,
            mr.request_id DESC
        LIMIT $2 OFFSET $3
    `;
    const VALUES = [data.receiver_id, data.limit || 6, data.offset || 0];
    const { rows } = await pool.query(SQLSTATEMENT, VALUES);
    return rows;
};

module.exports.selectActiveMatches = async function selectActiveMatches(data) {
    const SQLSTATEMENT = `
        SELECT mr.*, u.name, u.username, u.profile_pic, u.is_online 
        FROM MatchRequest mr
        JOIN "User" u ON (mr.sender_id = u.user_id OR mr.receiver_id = u.user_id)
        WHERE (mr.sender_id = $1 OR mr.receiver_id = $2) 
        AND mr.status = 'Accepted' 
        AND u.user_id != $3
    `;
    const VALUES = [data.user_id, data.user_id, data.user_id];
    const { rows } = await pool.query(SQLSTATEMENT, VALUES);
    return rows;
};

module.exports.insertRequest = async function insertRequest(data) {
    const SQLSTATEMENT = `
        INSERT INTO MatchRequest (sender_id, receiver_id, module_id, topic, time_slot, location, type, message) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING request_id
    `;
    const VALUES = [data.sender_id, data.receiver_id, data.module_id, data.topic, data.time_slot, data.location, data.type, data.message];
    const { rows } = await pool.query(SQLSTATEMENT, VALUES);
    return rows[0];
};

module.exports.selectById = async function selectById(data) {
    const SQLSTATEMENT = 'SELECT * FROM MatchRequest WHERE request_id = $1';
    const VALUES = [data.id];
    const { rows } = await pool.query(SQLSTATEMENT, VALUES);
    return rows;
};

module.exports.updateStatus = async function updateStatus(data) {
    const SQLSTATEMENT = 'UPDATE MatchRequest SET status = $1 WHERE request_id = $2';
    const VALUES = [data.status, data.id];
    const result = await pool.query(SQLSTATEMENT, VALUES);
    return result;
};

module.exports.autoMatch = async function autoMatch(data) {
    const SQLSTATEMENT = `
        SELECT u.user_id, u.name, u.username, u.profile_pic, u.year,
        d.name as diploma_name, d.code as diploma_code,
        (
            SELECT STRING_AGG(m.code, ', ') 
            FROM UserModule um 
            JOIN Module m ON um.module_id = m.module_id 
            WHERE um.user_id = u.user_id
        ) as modules,
        COUNT(um2.module_id) as shared_modules_count,
        (
            SELECT status FROM MatchRequest 
            WHERE ((sender_id = $1 AND receiver_id = u.user_id) 
            OR (sender_id = u.user_id AND receiver_id = $1))
            ORDER BY request_id DESC
            LIMIT 1
        ) as request_status
        FROM "User" u
        LEFT JOIN Diploma d ON u.diploma_id = d.diploma_id
        JOIN UserModule um2 ON u.user_id = um2.user_id
        JOIN UserModule um1 ON um1.module_id = um2.module_id
        WHERE um1.user_id = $1 AND u.user_id != $2
        GROUP BY u.user_id, u.name, u.username, u.profile_pic, u.year, d.name, d.code
        ORDER BY shared_modules_count DESC
        LIMIT 5
    `;
    const VALUES = [data.user_id, data.user_id];
    const { rows } = await pool.query(SQLSTATEMENT, VALUES);
    return rows;
};

module.exports.selectSharedModules = async function selectSharedModules(data) {
    const SQLSTATEMENT = `
        SELECT m.module_id, m.code, m.name
        FROM UserModule um1
        JOIN UserModule um2 ON um1.module_id = um2.module_id
        JOIN Module m ON um1.module_id = m.module_id
        WHERE um1.user_id = $1 AND um2.user_id = $2
    `;
    const VALUES = [data.user1_id, data.user2_id];
    const { rows } = await pool.query(SQLSTATEMENT, VALUES);
    return rows;
};

module.exports.selectById = async function selectById(data) {
    const SQLSTATEMENT = `
        SELECT mr.*, 
            u1.name as sender_name, u1.username as sender_username, u1.profile_pic as sender_pic,
            u2.name as receiver_name, u2.username as receiver_username, u2.profile_pic as receiver_pic,
            m.code as module_code, m.name as module_name
        FROM MatchRequest mr
        JOIN "User" u1 ON mr.sender_id = u1.user_id
        JOIN "User" u2 ON mr.receiver_id = u2.user_id
        LEFT JOIN Module m ON mr.module_id = m.module_id
        WHERE mr.request_id = $1
    `;
    const VALUES = [data.id];
    const { rows } = await pool.query(SQLSTATEMENT, VALUES);
    return rows[0];
};
