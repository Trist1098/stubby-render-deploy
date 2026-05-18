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

const statusLabels = {
  focus: 'Focusing',
  focusing: 'Focusing',
  break: 'On Break',
  on_break: 'On Break',
  need_help: 'Need Help',
  reviewing: 'Reviewing',
  uploading: 'Uploading Evidence',
  done: 'Completed',
  completed: 'Completed',
};

const allowedMemberStatuses = new Set(['focus', 'break', 'need_help']);

const prettyStatus = (status) =>
  statusLabels[status] ||
  status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const cssStatus = (status) => (status === 'break' ? 'on-break' : status.replace(/_/g, '-'));

const groupBy = (rows, key) =>
  rows.reduce((groups, row) => {
    const groupKey = row[key];
    groups[groupKey] = groups[groupKey] || [];
    groups[groupKey].push(row);
    return groups;
  }, {});

const mapAiCheck = (row) => ({
  id: row.id,
  study_session_id: row.study_session_id,
  micro_goal_id: row.micro_goal_id,
  user_id: row.user_id,
  equation_text: row.equation_text,
  file_name: row.file_name,
  file_type: row.file_type,
  status: row.feedback_status,
  summary: row.summary,
  strengths: row.strengths || [],
  issues: row.issues || [],
  next_step: row.next_step,
  confidence: row.confidence,
  created_at: row.created_at,
});

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
  const memberSql = `
    SELECT
      sm.member_id AS id,
      sm.user_id,
      CASE
        WHEN ss.started_at IS NULL THEN 0
        ELSE GREATEST(
          FLOOR(
            EXTRACT(
              EPOCH FROM (
                CURRENT_TIMESTAMP
                - GREATEST(COALESCE(current_status_event.started_at, ss.started_at), ss.started_at)
              )
            )
          )::INT,
          0
        )
      END AS status_timer,
      LOWER(REPLACE(COALESCE(sm.status, 'focus'), ' ', '_')) AS status,
      u.name,
      u.profile_pic AS avatar_url,
      LEAST(GREATEST(COALESCE(mgp.progress_percent, sm.progress, 0), 0), 100) AS progress_percent
    FROM SessionMember sm
    INNER JOIN StudySession ss ON ss.session_id = sm.session_id
    INNER JOIN "User" u ON u.user_id = sm.user_id
    LEFT JOIN micro_goal_progress mgp
      ON mgp.micro_goal_id = $2
      AND mgp.user_id = sm.user_id
    LEFT JOIN LATERAL (
      SELECT se.started_at
      FROM status_events se
      WHERE se.study_session_participant_id = sm.member_id
        AND se.ended_at IS NULL
      ORDER BY se.started_at DESC
      LIMIT 1
    ) current_status_event ON TRUE
    WHERE sm.session_id = $1
      AND sm.left_at IS NULL
    ORDER BY sm.member_id ASC
  `;

  const goalSql = `
    SELECT
      mgp.id AS progress_id,
      mgp.user_id,
      mg.id,
      mg.title,
      mg.description,
      mg.status,
      mg.queue_position,
      mgp.progress_percent,
      mgp.is_completed,
      mgp.completed_at
    FROM micro_goal_progress mgp
    INNER JOIN micro_goals mg ON mg.id = mgp.micro_goal_id
    WHERE mg.study_session_id = $1
    ORDER BY
      CASE WHEN mg.id = $2 THEN 0 WHEN mgp.is_completed THEN 1 ELSE 2 END,
      mg.queue_position ASC,
      mg.id ASC
  `;

  const evidenceSql = `
    SELECT
      mgp.id AS progress_id,
      w.id,
      w.content_type,
      w.text_content,
      w.image_url AS url,
      w.created_at
    FROM micro_goal_workings w
    INNER JOIN micro_goal_progress mgp ON mgp.id = w.micro_goal_progress_id
    INNER JOIN micro_goals mg ON mg.id = mgp.micro_goal_id
    WHERE mg.study_session_id = $1
    ORDER BY w.created_at ASC, w.id ASC
  `;

  const membersResult = await pool.query(memberSql, [sessionId, microGoalId]);
  const goalsResult = await pool.query(goalSql, [sessionId, microGoalId]);
  const evidenceResult = await pool.query(evidenceSql, [sessionId]);

  const evidenceByProgress = groupBy(evidenceResult.rows, 'progress_id');
  const goalsByUser = groupBy(
    goalsResult.rows.map((goal) => ({
      id: goal.id,
      title: goal.title,
      description: goal.description,
      status: goal.status,
      queue_position: goal.queue_position,
      progress_percent: goal.progress_percent,
      is_completed: goal.is_completed,
      completed_at: goal.completed_at,
      is_current: goal.id === microGoalId,
      evidence: evidenceByProgress[goal.progress_id] || [],
      user_id: goal.user_id,
    })),
    'user_id',
  );

  return membersResult.rows.map((member) => ({
    id: member.id,
    user_id: member.user_id,
    name: member.name,
    avatar_url: member.avatar_url,
    status_timer: member.status_timer,
    current_status: prettyStatus(member.status),
    status_class: cssStatus(member.status),
    progress_percent: member.progress_percent,
    goals: goalsByUser[member.user_id] || [],
  }));
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

module.exports.selectMicroGoalById = async function selectMicroGoalById(sessionId, microGoalId) {
  const SQLSTATEMENT = `
        SELECT id, study_session_id, created_by_user_id, title, description, queue_position,
               status, activated_at, completed_at
        FROM micro_goals
        WHERE study_session_id = $1
          AND id = $2
    `;
  const { rows } = await pool.query(SQLSTATEMENT, [sessionId, microGoalId]);
  return rows[0] || null;
};

module.exports.insertMicroGoalAiCheck = async function insertMicroGoalAiCheck(data) {
  const SQLSTATEMENT = `
    INSERT INTO micro_goal_ai_checks (
      study_session_id,
      micro_goal_id,
      user_id,
      equation_text,
      file_name,
      file_type,
      feedback_status,
      summary,
      strengths,
      issues,
      next_step,
      confidence
    )
    SELECT $1, id, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, $12
    FROM micro_goals
    WHERE study_session_id = $1
      AND id = $2
    RETURNING id, study_session_id, micro_goal_id, user_id, equation_text, file_name,
              file_type, feedback_status, summary, strengths, issues, next_step,
              confidence, created_at
  `;
  const { rows } = await pool.query(SQLSTATEMENT, [
    data.study_session_id,
    data.micro_goal_id,
    data.user_id,
    data.equation_text || null,
    data.file_name || null,
    data.file_type || null,
    data.status,
    data.summary,
    JSON.stringify(data.strengths || []),
    JSON.stringify(data.issues || []),
    data.next_step || null,
    data.confidence || null,
  ]);
  return rows[0] ? mapAiCheck(rows[0]) : null;
};

module.exports.selectMicroGoalAiChecks = async function selectMicroGoalAiChecks(data) {
  const SQLSTATEMENT = `
    SELECT id, study_session_id, micro_goal_id, user_id, equation_text, file_name,
           file_type, feedback_status, summary, strengths, issues, next_step,
           confidence, created_at
    FROM micro_goal_ai_checks
    WHERE study_session_id = $1
      AND micro_goal_id = $2
      AND user_id = $3
    ORDER BY created_at DESC, id DESC
    LIMIT 20
  `;
  const { rows } = await pool.query(SQLSTATEMENT, [
    data.study_session_id,
    data.micro_goal_id,
    data.user_id,
  ]);
  return rows.map(mapAiCheck);
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

module.exports.insertMicroGoalEvidence = async function insertMicroGoalEvidence(data) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const progressSql = `
      INSERT INTO micro_goal_progress (
        micro_goal_id,
        user_id,
        progress_percent,
        is_completed,
        completed_at
      )
      SELECT id, $2, 100, TRUE, CURRENT_TIMESTAMP
      FROM micro_goals
      WHERE id = $1
        AND study_session_id = $3
      ON CONFLICT (micro_goal_id, user_id) DO UPDATE
      SET progress_percent = GREATEST(micro_goal_progress.progress_percent, 100),
          is_completed = TRUE,
          completed_at = COALESCE(micro_goal_progress.completed_at, CURRENT_TIMESTAMP),
          updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `;
    const progressResult = await client.query(progressSql, [
      data.micro_goal_id,
      data.user_id,
      data.study_session_id,
    ]);
    const progress = progressResult.rows[0];

    if (!progress) {
      await client.query('ROLLBACK');
      return null;
    }

    const evidenceSql = `
      INSERT INTO micro_goal_workings (
        micro_goal_progress_id,
        content_type,
        text_content,
        image_url
      )
      VALUES ($1, $2, $3, $4)
      RETURNING id, content_type, text_content, image_url AS url, created_at
    `;
    const evidenceResult = await client.query(evidenceSql, [
      progress.id,
      data.content_type,
      data.text_content || null,
      data.image_url || null,
    ]);

    await client.query(
      `
        UPDATE SessionMember
        SET progress = GREATEST(progress, 100)
        WHERE session_id = $1
          AND user_id = $2
      `,
      [data.study_session_id, data.user_id],
    );

    await client.query('COMMIT');
    return evidenceResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports.updateMicroGoalProgress = async function updateMicroGoalProgress(data) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const progressSql = `
      INSERT INTO micro_goal_progress (
        micro_goal_id,
        user_id,
        progress_percent,
        is_completed
      )
      SELECT id, $2, $4, FALSE
      FROM micro_goals
      WHERE id = $1
        AND study_session_id = $3
      ON CONFLICT (micro_goal_id, user_id) DO UPDATE
      SET progress_percent = EXCLUDED.progress_percent,
          updated_at = CURRENT_TIMESTAMP
      WHERE micro_goal_progress.is_completed = FALSE
      RETURNING id, micro_goal_id, user_id, progress_percent, is_completed, completed_at
    `;
    const progressResult = await client.query(progressSql, [
      data.micro_goal_id,
      data.user_id,
      data.study_session_id,
      data.progress_percent,
    ]);
    const progress = progressResult.rows[0];

    if (!progress) {
      await client.query('ROLLBACK');
      return null;
    }

    await client.query(
      `
        UPDATE SessionMember
        SET progress = $3
        WHERE session_id = $1
          AND user_id = $2
          AND left_at IS NULL
      `,
      [data.study_session_id, data.user_id, data.progress_percent],
    );

    await client.query('COMMIT');
    return progress;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports.updateMemberStatus = async function updateMemberStatus(data) {
  const normalizedStatus = data.status === 'focusing' ? 'focus' : data.status;
  if (!allowedMemberStatuses.has(normalizedStatus)) return null;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const memberSql = `
      UPDATE SessionMember
      SET status = $3,
          status_timer = 0
      WHERE session_id = $1
        AND user_id = $2
        AND left_at IS NULL
      RETURNING member_id, session_id, user_id, status, status_timer, progress
    `;
    const memberResult = await client.query(memberSql, [
      data.study_session_id,
      data.user_id,
      normalizedStatus,
    ]);
    const member = memberResult.rows[0];

    if (!member) {
      await client.query('ROLLBACK');
      return null;
    }

    await client.query(
      `
        UPDATE status_events
        SET ended_at = CURRENT_TIMESTAMP
        WHERE study_session_participant_id = $1
          AND ended_at IS NULL
      `,
      [member.member_id],
    );

    await client.query(
      `
        INSERT INTO status_events (study_session_participant_id, status)
        VALUES ($1, $2)
      `,
      [member.member_id, normalizedStatus],
    );

    await client.query('COMMIT');

    return {
      ...member,
      current_status: prettyStatus(normalizedStatus),
      status_class: cssStatus(normalizedStatus),
    };
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
