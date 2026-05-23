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

module.exports.create = async function create(data) {
    const SQLSTATEMENT = `
        INSERT INTO "User" (username, email, password, name)
        VALUES ($1, $2, $3, $4)
        RETURNING *
    `;
    const VALUES = [data.username, data.email, data.password, data.name];
    const { rows } = await pool.query(SQLSTATEMENT, VALUES);
    return rows[0];
};

module.exports.updateProfile = async function updateProfile(data) {
    const SQLSTATEMENT = `
        UPDATE "User"
        SET name = $1, email = $2, institution_id = $3, diploma_id = $4, year = $5, profile_text = $6
        WHERE user_id = $7
        RETURNING *
    `;
    const VALUES = [
        data.name,
        data.email,
        data.institutionId ? parseInt(data.institutionId) : null,
        data.diplomaId ? parseInt(data.diplomaId) : null,
        data.year ? parseInt(data.year) : 1,
        data.profileText || null,
        data.userId
    ];
    const { rows } = await pool.query(SQLSTATEMENT, VALUES);
    return rows[0];
};

module.exports.enrollModules = async function enrollModules(data) {
    // Clear existing enrollments first to avoid duplicates or stale data
    await pool.query('DELETE FROM UserModule WHERE user_id = $1', [data.user_id]);
    
    if (!data.module_ids || data.module_ids.length === 0) return;

    const placeholders = data.module_ids.map((_, i) => `($1, $${i + 2})`).join(', ');
    const SQLSTATEMENT = `
        INSERT INTO UserModule (user_id, module_id)
        VALUES ${placeholders}
    `;
    const VALUES = [data.user_id, ...data.module_ids];
    await pool.query(SQLSTATEMENT, VALUES);
};

module.exports.updateProfilePicture = async function updateProfilePicture(data) {
    const SQLSTATEMENT = `
        UPDATE "User"
        SET profile_pic = $1
        WHERE user_id = $2
        RETURNING *
    `;
    const VALUES = [data.profilePic, data.userId];
    const { rows } = await pool.query(SQLSTATEMENT, VALUES);
    return rows[0];
};

module.exports.selectByUserId = async function selectByUserId(data) {
    const SQLSTATEMENT = `
        SELECT *
        FROM "User"
        WHERE user_id = $1
    `;
    const VALUES = [data.userId];
    const { rows } = await pool.query(SQLSTATEMENT, VALUES);
    return rows[0];
};

module.exports.completeOnboardingModel = async function completeOnboardingModel(data) {
    const SQLSTATEMENT = `
        UPDATE "User"
        SET institution_id = $1, diploma_id = $2, year = $3
        WHERE user_id = $4
        RETURNING *
    `;
    const VALUES = [
        data.institutionId ? parseInt(data.institutionId) : null,
        data.diplomaId ? parseInt(data.diplomaId) : null,
        data.year ? parseInt(data.year) : 1,
        data.userId
    ];
    const { rows } = await pool.query(SQLSTATEMENT, VALUES);
    return rows[0];
};