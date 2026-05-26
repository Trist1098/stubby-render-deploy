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
        SELECT mr.*,
               u.user_id,
               u.name,
               u.username,
               u.profile_pic,
               u.is_online,
               m.code AS module_code,
               m.name AS module_name,
               ce.event_id,
               (
                 SELECT cc.conversation_id
                 FROM ChatConversation cc
                 JOIN ConversationMember cm_a ON cm_a.conversation_id = cc.conversation_id
                 JOIN ConversationMember cm_b ON cm_b.conversation_id = cc.conversation_id
                 WHERE cc.type = 'friend'
                   AND cm_a.user_id = $1
                   AND cm_b.user_id = u.user_id
                 LIMIT 1
               ) AS conversation_id
        FROM MatchRequest mr
        JOIN "User" u ON u.user_id = CASE
            WHEN mr.sender_id = $1 THEN mr.receiver_id
            ELSE mr.sender_id
        END
        LEFT JOIN Module m ON mr.module_id = m.module_id
        LEFT JOIN CalendarEvent ce ON ce.request_id = mr.request_id
        WHERE (mr.sender_id = $1 OR mr.receiver_id = $2) 
        AND mr.status = 'Accepted' 
        AND NOT EXISTS (
            SELECT 1
            FROM MatchBlockedStudent mb
            WHERE (mb.user_id = $1 AND mb.target_user_id = u.user_id)
               OR (mb.user_id = u.user_id AND mb.target_user_id = $1)
        )
        AND NOT EXISTS (
            SELECT 1
            FROM MatchReport mrep
            WHERE mrep.reporter_id = $1 AND mrep.reported_user_id = u.user_id
        )
        ORDER BY mr.updated_at DESC, mr.request_id DESC
    `;
  const VALUES = [data.user_id, data.user_id];
  const { rows } = await pool.query(SQLSTATEMENT, VALUES);
  return rows;
};

module.exports.selectProfileMatches = async function selectProfileMatches(data) {
  const SQLSTATEMENT = `
        SELECT mr.request_id,
               mr.topic,
               mr.updated_at,
               u.user_id,
               u.name,
               u.username,
               u.profile_pic,
               m.code AS module_code,
               m.name AS module_name,
               d.name AS diploma_name,
               i.name AS institution_name
        FROM MatchRequest mr
        JOIN "User" u
          ON (mr.sender_id = $1 AND u.user_id = mr.receiver_id)
          OR (mr.receiver_id = $1 AND u.user_id = mr.sender_id)
        LEFT JOIN Module m ON m.module_id = mr.module_id
        LEFT JOIN Diploma d ON d.diploma_id = u.diploma_id
        LEFT JOIN Institution i ON i.institution_id = u.institution_id
        WHERE (mr.sender_id = $1 OR mr.receiver_id = $1)
          AND mr.status = 'Accepted'
        ORDER BY mr.updated_at DESC, mr.request_id DESC
    `;
  const { rows } = await pool.query(SQLSTATEMENT, [data.user_id]);
  return rows;
};

module.exports.insertRequest = async function insertRequest(data) {
  const SQLSTATEMENT = `
        INSERT INTO MatchRequest (sender_id, receiver_id, module_id, topic, time_slot, location, is_online, type, co_participants, message) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING request_id
    `;
  const VALUES = [
    data.sender_id,
    data.receiver_id,
    data.module_id,
    data.topic,
    data.time_slot,
    data.location,
    data.is_online || false,
    data.type,
    data.co_participants || [],
    data.message,
  ];
  const { rows } = await pool.query(SQLSTATEMENT, VALUES);
  return rows[0];
};

module.exports.updateStatus = async function updateStatus(data) {
  const SQLSTATEMENT = 'UPDATE MatchRequest SET status = $1 WHERE request_id = $2';
  const VALUES = [data.status, data.id];
  const result = await pool.query(SQLSTATEMENT, VALUES);
  return result;
};

module.exports.autoMatch = async function autoMatch(data) {
  const SQLSTATEMENT = `
        SELECT u.user_id, u.name, u.username, u.profile_pic, u.year, u.is_online, u.profile_text, u.institution_id, u.diploma_id,
        d.name as diploma_name, d.code as diploma_code,
        i.name as institution_name,
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
        ) as request_status,
        EXISTS (
            SELECT 1
            FROM MatchSavedStudent mss
            WHERE mss.user_id = $1 AND mss.target_user_id = u.user_id
        ) AS is_saved,
        mp.availability_days, mp.selected_modes, mp.selected_times, mp.start_time, mp.end_time,
        mp.style, mp.duration, mp.priority, mp.gender_pref, mp.partner_level, mp.selected_languages
        FROM "User" u
        LEFT JOIN Diploma d ON u.diploma_id = d.diploma_id
        LEFT JOIN Institution i ON u.institution_id = i.institution_id
        LEFT JOIN MatchPreference mp ON u.user_id = mp.user_id
        JOIN UserModule um2 ON u.user_id = um2.user_id
        JOIN UserModule um1 ON um1.module_id = um2.module_id
        WHERE um1.user_id = $1 AND u.user_id != $2
        AND NOT EXISTS (
            SELECT 1
            FROM MatchHiddenStudent mh
            WHERE mh.user_id = $1 AND mh.target_user_id = u.user_id
        )
        AND NOT EXISTS (
            SELECT 1
            FROM MatchBlockedStudent mb
            WHERE (mb.user_id = $1 AND mb.target_user_id = u.user_id)
               OR (mb.user_id = u.user_id AND mb.target_user_id = $1)
        )
        AND NOT EXISTS (
            SELECT 1
            FROM MatchReport mrep
            WHERE mrep.reporter_id = $1 AND mrep.reported_user_id = u.user_id
        )
        GROUP BY u.user_id, u.name, u.username, u.profile_pic, u.year, u.is_online, u.profile_text, u.institution_id, u.diploma_id, d.name, d.code, i.name,
                 mp.availability_days, mp.selected_modes, mp.selected_times, mp.start_time, mp.end_time,
                 mp.style, mp.duration, mp.priority, mp.gender_pref, mp.partner_level, mp.selected_languages
        ORDER BY shared_modules_count DESC
        LIMIT 30
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
            m.code as module_code, m.name as module_name,
            ce.event_id,
            (
                SELECT cc.conversation_id
                FROM ChatConversation cc
                JOIN ConversationMember cm_sender ON cm_sender.conversation_id = cc.conversation_id
                JOIN ConversationMember cm_receiver ON cm_receiver.conversation_id = cc.conversation_id
                WHERE cc.type = 'friend'
                  AND cm_sender.user_id = mr.sender_id
                  AND cm_receiver.user_id = mr.receiver_id
                LIMIT 1
            ) AS conversation_id,
            COALESCE(
                (
                    SELECT json_agg(u3.name) 
                    FROM "User" u3 
                    WHERE u3.user_id = ANY(mr.co_participants)
                ), '[]'::json
            ) as co_participant_names
        FROM MatchRequest mr
        JOIN "User" u1 ON mr.sender_id = u1.user_id
        JOIN "User" u2 ON mr.receiver_id = u2.user_id
        LEFT JOIN Module m ON mr.module_id = m.module_id
        LEFT JOIN CalendarEvent ce ON ce.request_id = mr.request_id
        WHERE mr.request_id = $1
    `;
  const VALUES = [data.id];
  const { rows } = await pool.query(SQLSTATEMENT, VALUES);
  return rows[0];
};

module.exports.selectSavedStudents = async function selectSavedStudents(data) {
  const SQLSTATEMENT = `
        SELECT u.user_id,
               u.name,
               u.username,
               u.profile_pic,
               u.year,
               u.is_online,
               u.profile_text,
               u.institution_id,
               u.diploma_id,
               d.name AS diploma_name,
               d.code AS diploma_code,
               i.name AS institution_name,
               (
                   SELECT STRING_AGG(m.code, ', ')
                   FROM UserModule um
                   JOIN Module m ON um.module_id = m.module_id
                   WHERE um.user_id = u.user_id
               ) AS modules,
               (
                   SELECT COUNT(*)
                   FROM UserModule um2
                   JOIN UserModule um1 ON um1.module_id = um2.module_id
                   WHERE um1.user_id = $1 AND um2.user_id = u.user_id
               ) AS shared_modules_count,
               (
                   SELECT status
                   FROM MatchRequest
                   WHERE ((sender_id = $1 AND receiver_id = u.user_id)
                      OR (sender_id = u.user_id AND receiver_id = $1))
                   ORDER BY request_id DESC
                   LIMIT 1
               ) AS request_status,
               TRUE AS is_saved,
               mp.availability_days,
               mp.selected_modes,
               mp.selected_times,
               mp.start_time,
               mp.end_time,
               mp.style,
               mp.duration,
               mp.priority,
               mp.gender_pref,
               mp.partner_level,
               mp.selected_languages
        FROM MatchSavedStudent mss
        JOIN "User" u ON u.user_id = mss.target_user_id
        LEFT JOIN Diploma d ON u.diploma_id = d.diploma_id
        LEFT JOIN Institution i ON u.institution_id = i.institution_id
        LEFT JOIN MatchPreference mp ON u.user_id = mp.user_id
        WHERE mss.user_id = $1
          AND NOT EXISTS (
              SELECT 1
              FROM MatchHiddenStudent mh
              WHERE mh.user_id = $1 AND mh.target_user_id = u.user_id
          )
          AND NOT EXISTS (
              SELECT 1
              FROM MatchBlockedStudent mb
              WHERE (mb.user_id = $1 AND mb.target_user_id = u.user_id)
                 OR (mb.user_id = u.user_id AND mb.target_user_id = $1)
          )
          AND NOT EXISTS (
              SELECT 1
              FROM MatchReport mrep
              WHERE mrep.reporter_id = $1 AND mrep.reported_user_id = u.user_id
          )
        ORDER BY mss.created_at DESC
    `;
  const { rows } = await pool.query(SQLSTATEMENT, [data.user_id]);
  return rows;
};

module.exports.selectInteractionState = async function selectInteractionState(data) {
  const SQLSTATEMENT = `
        SELECT
            EXISTS (
                SELECT 1 FROM MatchSavedStudent
                WHERE user_id = $1 AND target_user_id = $2
            ) AS is_saved,
            EXISTS (
                SELECT 1 FROM MatchHiddenStudent
                WHERE user_id = $1 AND target_user_id = $2
            ) AS is_hidden,
            EXISTS (
                SELECT 1 FROM MatchBlockedStudent
                WHERE user_id = $1 AND target_user_id = $2
            ) AS blocked_by_me,
            EXISTS (
                SELECT 1 FROM MatchBlockedStudent
                WHERE user_id = $2 AND target_user_id = $1
            ) AS blocked_me,
            EXISTS (
                SELECT 1 FROM MatchReport
                WHERE reporter_id = $1 AND reported_user_id = $2
            ) AS is_reported
    `;
  const { rows } = await pool.query(SQLSTATEMENT, [data.user_id, data.target_user_id]);
  return rows[0];
};

module.exports.saveStudent = async function saveStudent(data) {
  const SQLSTATEMENT = `
        INSERT INTO MatchSavedStudent (user_id, target_user_id)
        VALUES ($1, $2)
        ON CONFLICT (user_id, target_user_id) DO NOTHING
        RETURNING *
    `;
  const { rows } = await pool.query(SQLSTATEMENT, [data.user_id, data.target_user_id]);
  return rows[0] || null;
};

module.exports.unsaveStudent = async function unsaveStudent(data) {
  const result = await pool.query(
    'DELETE FROM MatchSavedStudent WHERE user_id = $1 AND target_user_id = $2',
    [data.user_id, data.target_user_id]
  );
  return result.rowCount;
};

module.exports.hideStudent = async function hideStudent(data) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'DELETE FROM MatchSavedStudent WHERE user_id = $1 AND target_user_id = $2',
      [data.user_id, data.target_user_id]
    );
    await client.query(
      `INSERT INTO MatchHiddenStudent (user_id, target_user_id, reason)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, target_user_id)
       DO UPDATE SET reason = EXCLUDED.reason`,
      [data.user_id, data.target_user_id, data.reason || null]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports.unhideStudent = async function unhideStudent(data) {
  const result = await pool.query(
    'DELETE FROM MatchHiddenStudent WHERE user_id = $1 AND target_user_id = $2',
    [data.user_id, data.target_user_id]
  );
  return result.rowCount;
};

module.exports.blockStudent = async function blockStudent(data) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'DELETE FROM MatchSavedStudent WHERE user_id = $1 AND target_user_id = $2',
      [data.user_id, data.target_user_id]
    );
    await client.query(
      'DELETE FROM MatchHiddenStudent WHERE user_id = $1 AND target_user_id = $2',
      [data.user_id, data.target_user_id]
    );
    await client.query(
      `INSERT INTO MatchBlockedStudent (user_id, target_user_id, reason)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, target_user_id)
       DO UPDATE SET reason = EXCLUDED.reason`,
      [data.user_id, data.target_user_id, data.reason || null]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports.unblockStudent = async function unblockStudent(data) {
  const result = await pool.query(
    'DELETE FROM MatchBlockedStudent WHERE user_id = $1 AND target_user_id = $2',
    [data.user_id, data.target_user_id]
  );
  return result.rowCount;
};

module.exports.reportStudent = async function reportStudent(data) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const reportResult = await client.query(
      `INSERT INTO MatchReport (reporter_id, reported_user_id, reason, details)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.user_id, data.target_user_id, data.reason, data.details || null]
    );
    await client.query(
      'DELETE FROM MatchSavedStudent WHERE user_id = $1 AND target_user_id = $2',
      [data.user_id, data.target_user_id]
    );
    await client.query(
      `INSERT INTO MatchHiddenStudent (user_id, target_user_id, reason)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, target_user_id)
       DO UPDATE SET reason = EXCLUDED.reason`,
      [data.user_id, data.target_user_id, 'Reported']
    );
    await client.query('COMMIT');
    return reportResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
