const pool = require('./db');

const selectSessionOwnerForUpdate = async (client, sessionId) => {
  const SQLSTATEMENT = `
        SELECT host_id AS created_by_user_id
        FROM StudySession
        WHERE session_id = $1
        FOR UPDATE
    `;
  const { rows } = await client.query(SQLSTATEMENT, [sessionId]);
  return rows[0] || null;
};

const countMicroGoals = async (client, sessionId) => {
  const SQLSTATEMENT = `
        SELECT COUNT(*)::INT AS goal_count
        FROM micro_goals
        WHERE study_session_id = $1
    `;
  const { rows } = await client.query(SQLSTATEMENT, [sessionId]);
  return rows[0].goal_count;
};

const insertMicroGoalRow = async (client, data) => {
  const SQLSTATEMENT = `
        INSERT INTO micro_goals (
            study_session_id,
            created_by_user_id,
            title,
            description,
            queue_position,
            status,
            activated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $6 = 'active' THEN CURRENT_TIMESTAMP ELSE NULL END)
        RETURNING id, study_session_id, created_by_user_id, title, description, queue_position,
                  status, activated_at, completed_at
    `;
  const { rows } = await client.query(SQLSTATEMENT, [
    data.study_session_id,
    data.created_by_user_id,
    data.title,
    data.description || null,
    data.queue_position,
    data.status,
  ]);
  return rows[0];
};

module.exports.selectSessionById = async function selectSessionById(sessionId) {
  const SQLSTATEMENT = `
        SELECT
            ss.session_id AS id,
            ss.title,
            ss.host_id AS created_by_user_id,
            COALESCE(ss.planned_duration_seconds, ss.duration) AS planned_duration_seconds,
            ss.started_at,
            COALESCE(ss.ended_at, ss.completed_at) AS ended_at,
            ss.status,
            GREATEST(
              COALESCE(ss.planned_duration_seconds, ss.duration, 0)
              - FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - COALESCE(ss.started_at, CURRENT_TIMESTAMP))))::INT,
              0
            ) AS remaining_seconds
        FROM StudySession ss
        WHERE ss.session_id = $1
    `;
  const { rows } = await pool.query(SQLSTATEMENT, [sessionId]);
  return rows[0] || null;
};

module.exports.selectCurrentMicroGoal = async function selectCurrentMicroGoal(sessionId) {
  const SQLSTATEMENT = `
        SELECT id, study_session_id, created_by_user_id, title, description, queue_position,
               status, activated_at, completed_at
        FROM micro_goals
        WHERE study_session_id = $1
        ORDER BY
            CASE status WHEN 'active' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
            queue_position ASC,
            id ASC
        LIMIT 1
    `;
  const { rows } = await pool.query(SQLSTATEMENT, [sessionId]);
  return rows[0] || null;
};

module.exports.selectSessionMembers = async function selectSessionMembers(
  sessionId,
  microGoalId = null,
) {
  const SQLSTATEMENT = `
        SELECT
            sm.member_id AS id,
            sm.user_id,
            u.name,
            u.profile_pic AS avatar_url,
            CASE LOWER(REPLACE(COALESCE(sm.status, 'focusing'), ' ', '_'))
                WHEN 'focus' THEN 'Focusing'
                WHEN 'focusing' THEN 'Focusing'
                WHEN 'on_break' THEN 'On Break'
                WHEN 'need_help' THEN 'Need Help'
                ELSE sm.status
            END AS current_status,
            REPLACE(LOWER(REPLACE(COALESCE(sm.status, 'focusing'), ' ', '_')), '_', '-') AS status_class,
            LEAST(GREATEST(COALESCE(mgp.progress_percent, sm.progress, 0), 0), 100) AS progress_percent
        FROM SessionMember sm
        INNER JOIN "User" u ON u.user_id = sm.user_id
        LEFT JOIN micro_goal_progress mgp
            ON mgp.micro_goal_id = $2
            AND mgp.user_id = sm.user_id
        WHERE sm.session_id = $1
          AND sm.left_at IS NULL
        ORDER BY sm.joined_at ASC, sm.member_id ASC
    `;
  const { rows } = await pool.query(SQLSTATEMENT, [sessionId, microGoalId]);
  return rows;
};

module.exports.selectMicroGoalsBySessionId = async function selectMicroGoalsBySessionId(sessionId) {
  const SQLSTATEMENT = `
        SELECT id, study_session_id, created_by_user_id, title, description, queue_position,
               status, activated_at, completed_at
        FROM micro_goals
        WHERE study_session_id = $1
        ORDER BY
            CASE status WHEN 'active' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
            queue_position ASC,
            id ASC
    `;
  const { rows } = await pool.query(SQLSTATEMENT, [sessionId]);
  return rows;
};

module.exports.selectQueuedMicroGoals = async function selectQueuedMicroGoals(
  sessionId,
  currentGoalId = null,
) {
  const SQLSTATEMENT = `
        SELECT id, study_session_id, created_by_user_id, title, description, queue_position,
               status, activated_at, completed_at
        FROM micro_goals
        WHERE study_session_id = $1
          AND status = 'pending'
          AND id <> COALESCE($2, -1)
        ORDER BY queue_position ASC, id ASC
    `;
  const { rows } = await pool.query(SQLSTATEMENT, [sessionId, currentGoalId]);
  return rows;
};

module.exports.insertMicroGoal = async function insertMicroGoal(data) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const session = await selectSessionOwnerForUpdate(client, data.study_session_id);
    if (!session) {
      await client.query('ROLLBACK');
      return null;
    }

    const goalCount = await countMicroGoals(client, data.study_session_id);
    const queuePosition = goalCount + 1;
    const status = goalCount === 0 ? 'active' : 'pending';
    const goal = await insertMicroGoalRow(client, {
      ...data,
      created_by_user_id: data.created_by_user_id || session.created_by_user_id,
      queue_position: queuePosition,
      status,
    });

    await client.query('COMMIT');
    return goal;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports.exitSession = async function exitSession(sessionId) {
  const SQLSTATEMENT = `
        UPDATE StudySession
        SET status = 'completed',
            ended_at = COALESCE(ended_at, CURRENT_TIMESTAMP),
            completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP)
        WHERE session_id = $1
        RETURNING
            session_id AS id,
            title,
            host_id AS created_by_user_id,
            COALESCE(planned_duration_seconds, duration) AS planned_duration_seconds,
            started_at,
            COALESCE(ended_at, completed_at) AS ended_at,
            status
    `;
  const { rows } = await pool.query(SQLSTATEMENT, [sessionId]);
  return rows[0] || null;
};
