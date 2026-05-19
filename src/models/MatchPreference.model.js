const pool = require('./db');

module.exports.selectByUserId = async function selectByUserId(data) {
    const SQLSTATEMENT = 'SELECT * FROM MatchPreference WHERE user_id = $1';
    const VALUES = [data.userId];
    const { rows } = await pool.query(SQLSTATEMENT, VALUES);
    return rows[0];
};

module.exports.upsert = async function upsert(data) {
    const SQLSTATEMENT = `
        INSERT INTO MatchPreference (
            user_id, selected_modules, availability_days, 
            selected_modes, selected_times, style, 
            duration, priority, gender_pref, partner_level,
            additional_details, auto_match_enabled, selected_languages
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (user_id) 
        DO UPDATE SET 
            selected_modules = EXCLUDED.selected_modules,
            availability_days = EXCLUDED.availability_days,
            selected_modes = EXCLUDED.selected_modes,
            selected_times = EXCLUDED.selected_times,
            style = EXCLUDED.style,
            duration = EXCLUDED.duration,
            priority = EXCLUDED.priority,
            gender_pref = EXCLUDED.gender_pref,
            partner_level = EXCLUDED.partner_level,
            additional_details = EXCLUDED.additional_details,
            auto_match_enabled = EXCLUDED.auto_match_enabled,
            selected_languages = EXCLUDED.selected_languages
        RETURNING *;
    `;
    const VALUES = [
        data.userId,
        JSON.stringify(data.selected_modules || []),
        JSON.stringify(data.availability_days || []),
        JSON.stringify(data.selected_modes || []),
        JSON.stringify(data.selected_times || []),
        data.style || 'discussion',
        data.duration || 60,
        data.priority || 50,
        data.gender_pref || 'any',
        data.partner_level || 'same',
        data.additional_details || '',
        data.auto_match_enabled || false,
        JSON.stringify(data.selected_languages || [])
    ];
    const { rows } = await pool.query(SQLSTATEMENT, VALUES);
    return rows[0];
};
