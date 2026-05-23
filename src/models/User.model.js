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
  const institutionId = data.institutionId ?? data.institution_id;
  const diplomaId = data.diplomaId ?? data.diploma_id;
  const isPrivate = data.isPrivate ?? data.is_private ?? false;
  const friendRequestPrivate = data.friendRequestPrivate ?? data.friend_request_private ?? false;
  const pushNotif = data.pushNotif ?? data.push_notif ?? true;
  const profileText = data.profileText ?? data.profile_text ?? null;
  const fields = [
    'name = $1',
    'email = $2',
    'institution_id = $3',
    'diploma_id = $4',
    'year = $5',
    'profile_text = $6',
    'is_private = $7',
    'friend_request_private = $8',
    'theme = $9',
    'language = $10',
    'push_notif = $11',
  ];
  const values = [
    data.name,
    data.email,
    institutionId ? parseInt(institutionId) : null,
    diplomaId ? parseInt(diplomaId) : null,
    data.year ? parseInt(data.year) : 1,
    profileText,
    isPrivate === true,
    friendRequestPrivate === true,
    data.theme || 'Light',
    data.language || 'English',
    pushNotif !== false,
  ];

  if (data.password) {
    fields.push(`password = $${fields.length + 1}`);
    values.push(data.password);
  }

  values.push(data.userId ?? data.user_id);
  const SQLSTATEMENT = `
        UPDATE "User"
        SET ${fields.join(', ')}
        WHERE user_id = $${values.length}
        RETURNING *
    `;
  const { rows } = await pool.query(SQLSTATEMENT, values);
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

module.exports.updateProfileBanner = async function updateProfileBanner(data) {
  const SQLSTATEMENT = `
        UPDATE "User"
        SET profile_banner = $1
        WHERE user_id = $2
        RETURNING *
    `;
  const VALUES = [data.profileBanner, data.userId];
  const { rows } = await pool.query(SQLSTATEMENT, VALUES);
  return rows[0];
};

module.exports.updatePassword = async function updatePassword(data) {
  const SQLSTATEMENT = `
        UPDATE "User"
        SET password = $1
        WHERE user_id = $2
        RETURNING *
    `;
  const VALUES = [data.password, data.userId];
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

module.exports.selectPublicUserById = async function selectPublicUserById(data) {
  const SQLSTATEMENT = `
        SELECT user_id,
               username,
               name,
               profile_pic,
               profile_banner,
               is_private,
               friend_request_private
        FROM "User"
        WHERE user_id = $1
    `;
  const VALUES = [data.userId];
  const { rows } = await pool.query(SQLSTATEMENT, VALUES);
  return rows[0];
};

module.exports.searchStudents = async function searchStudents(data) {
  const searchTerm = `%${data.query || ''}%`;
  const SQLSTATEMENT = `
        SELECT u.user_id,
               u.username,
               u.name,
               u.profile_pic,
               u.profile_text,
               u.year,
               i.name AS institution_name,
               d.name AS diploma_name
        FROM "User" u
        LEFT JOIN Institution i ON i.institution_id = u.institution_id
        LEFT JOIN Diploma d ON d.diploma_id = u.diploma_id
        WHERE u.user_id <> $1
          AND (
              u.name ILIKE $2
              OR u.username ILIKE $2
              OR COALESCE(i.name, '') ILIKE $2
              OR COALESCE(d.name, '') ILIKE $2
          )
        ORDER BY u.name ASC
        LIMIT 12
    `;
  const VALUES = [data.userId, searchTerm];
  const { rows } = await pool.query(SQLSTATEMENT, VALUES);
  return rows;
};
