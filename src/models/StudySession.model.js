const pool = require('./db');

const makeError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

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
        VALUES ($1, $2, $3, $4, $5, $6::varchar, CASE WHEN $6::text = 'active' THEN CURRENT_TIMESTAMP ELSE NULL END)
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
  in_consultation: 'In Consultation',
  reviewing: 'Reviewing',
  uploading: 'Uploading Evidence',
  done: 'Completed',
  completed: 'Completed',
};

const allowedMemberStatuses = new Set(['focus', 'break', 'need_help', 'in_consultation']);

const normalizeMemberStatus = (status) => {
  const normalized = String(status || 'focus')
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (normalized === 'focusing') return 'focus';
  if (normalized === 'on_break') return 'break';
  return normalized;
};

const prettyStatus = (status) =>
  statusLabels[status] ||
  status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const cssStatus = (status) => (status === 'break' ? 'on-break' : status.replace(/_/g, '-'));

const updateMemberStatusesInTransaction = async (client, sessionId, userIds, status) => {
  const normalizedUserIds = [...new Set(userIds.map(Number).filter((id) => Number.isInteger(id)))];
  if (!normalizedUserIds.length) return [];

  await client.query(
    `
      UPDATE StudySession
      SET started_at = COALESCE(started_at, CURRENT_TIMESTAMP)
      WHERE session_id = $1
    `,
    [sessionId],
  );

  const memberResult = await client.query(
    `
      UPDATE SessionMember
      SET status = $3,
          status_timer = 0
      WHERE session_id = $1
        AND user_id = ANY($2::int[])
        AND left_at IS NULL
      RETURNING member_id, session_id, user_id, status, status_timer, progress
    `,
    [sessionId, normalizedUserIds, status],
  );

  const memberIds = memberResult.rows.map((member) => member.member_id);
  if (!memberIds.length) return [];

  await client.query(
    `
      UPDATE status_events
      SET ended_at = CURRENT_TIMESTAMP
      WHERE study_session_participant_id = ANY($1::int[])
        AND ended_at IS NULL
    `,
    [memberIds],
  );

  await client.query(
    `
      INSERT INTO status_events (study_session_participant_id, status)
      SELECT unnest($1::int[]), $2
    `,
    [memberIds, status],
  );

  return memberResult.rows.map((member) => ({
    ...member,
    current_status: prettyStatus(status),
    status_class: cssStatus(status),
  }));
};

const insertNotification = async (client, data) => {
  const { rows } = await client.query(
    `
      INSERT INTO Notification (user_id, title, message, type, is_read, nav_target)
      VALUES ($1, $2, $3, $4, FALSE, $5)
      RETURNING notification_id, user_id, title, message, type, is_read, nav_target, created_at
    `,
    [data.user_id, data.title, data.message || null, data.type || 'info', data.nav_target || null],
  );
  return rows[0] || null;
};

const groupBy = (rows, key) =>
  rows.reduce((groups, row) => {
    const groupKey = row[key];
    groups[groupKey] = groups[groupKey] || [];
    groups[groupKey].push(row);
    return groups;
  }, {});

const clampScore = (value) => Math.min(Math.max(Math.round(value), 0), 100);

const buildFocusCredit = (row = {}) => {
  const focusSeconds = Number(row.focus_seconds) || 0;
  const plannedSessionSeconds = Number(row.planned_session_seconds) || 0;
  const completedMicroGoals = Number(row.completed_micro_goals) || 0;
  const evidenceUploads = Number(row.evidence_uploads) || 0;
  const helpParticipation = Number(row.help_participation) || 0;

  const focusMinutes = Math.floor(focusSeconds / 60);
  const focusPoints = plannedSessionSeconds
    ? Math.min(Math.floor((focusSeconds / plannedSessionSeconds) * 20), 20)
    : 0;
  const goalPoints = Math.min(completedMicroGoals * 10, 20);
  const evidencePoints = Math.min(evidenceUploads * 8, 20);
  const helpPoints = Math.min(helpParticipation * 5, 15);
  const score = clampScore(45 + focusPoints + goalPoints + evidencePoints + helpPoints);

  let label = 'Getting started';
  if (score >= 85) label = 'Excellent';
  else if (score >= 70) label = 'Reliable';
  else if (score >= 55) label = 'Building';

  return {
    score,
    label,
    focus_minutes: focusMinutes,
    completed_micro_goals: completedMicroGoals,
    evidence_uploads: evidenceUploads,
    help_participation: helpParticipation,
    breakdown: {
      focus: focusPoints,
      micro_goals: goalPoints,
      evidence: evidencePoints,
      help: helpPoints,
    },
  };
};

const focusStatusOrder = ['focus', 'break', 'need_help', 'in_consultation'];

const focusStatusLabels = {
  focus: 'Focusing',
  break: 'On Break',
  need_help: 'Need Help',
  in_consultation: 'In Consultation',
};

const dateMs = (value) => {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
};

const maxDate = (...values) => {
  const times = values.map(dateMs).filter((time) => time !== null);
  return times.length ? new Date(Math.max(...times)) : null;
};

const minDate = (...values) => {
  const times = values.map(dateMs).filter((time) => time !== null);
  return times.length ? new Date(Math.min(...times)) : null;
};

const secondsBetween = (start, end) => {
  const startTime = dateMs(start);
  const endTime = dateMs(end);
  if (startTime === null || endTime === null || endTime <= startTime) return 0;
  return Math.floor((endTime - startTime) / 1000);
};

const addStatusSeconds = (totals, status, start, end) => {
  const normalizedStatus = normalizeMemberStatus(status);
  if (!focusStatusOrder.includes(normalizedStatus)) return;
  totals[normalizedStatus] += secondsBetween(start, end);
};

const buildFocusStatusSegments = (totals) => {
  const totalSeconds = focusStatusOrder.reduce((sum, status) => sum + totals[status], 0);
  return focusStatusOrder.map((status) => {
    const seconds = totals[status];
    return {
      status,
      label: focusStatusLabels[status],
      seconds,
      percentage: totalSeconds ? Number(((seconds / totalSeconds) * 100).toFixed(1)) : 0,
    };
  });
};

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

const mapConsultationReflection = (row) =>
  row
    ? {
        id: row.id,
        consultation_session_id: row.consultation_session_id,
        submitted_by_user_id: row.submitted_by_user_id,
        submitted_by_name: row.submitted_by_name,
        student_understood: row.student_understood,
        summary_checklist: row.summary_checklist_json || [],
        additional_notes: row.additional_notes,
        created_at: row.created_at,
      }
    : null;

const mapConsultationSession = (row, reflection = null) => ({
  id: row.id,
  study_session_id: row.study_session_id,
  session_title: row.session_title,
  student_user_id: row.student_user_id,
  student_name: row.student_name,
  teacher_user_id: row.teacher_user_id,
  teacher_name: row.teacher_name,
  topic: row.topic,
  question_text: row.question_text,
  student_attempt_text: row.student_attempt_text,
  teacher_direction: row.teacher_direction,
  status: row.status,
  started_at: row.started_at,
  ended_at: row.ended_at,
  reflection,
});

const mapConsultationWorkspace = (row) => {
  if (!row) {
    return {
      whiteboard_strokes: [],
      scratchpad_text: '',
      updated_at: null,
      updated_by_user_id: null,
    };
  }

  let workspace;
  try {
    workspace = JSON.parse(row.note_text || '{}');
  } catch {
    workspace = { scratchpad_text: row.note_text || '' };
  }

  return {
    whiteboard_strokes: Array.isArray(workspace.whiteboard_strokes)
      ? workspace.whiteboard_strokes
      : [],
    scratchpad_text: typeof workspace.scratchpad_text === 'string' ? workspace.scratchpad_text : '',
    updated_at: row.updated_at,
    updated_by_user_id: row.user_id,
  };
};

const selectConsultationDetails = async (executor, sessionId, consultationId) => {
  const sessionSql = `
    SELECT
      cs.id,
      cs.study_session_id,
      ss.title AS session_title,
      cs.student_user_id,
      student.name AS student_name,
      cs.teacher_user_id,
      teacher.name AS teacher_name,
      cs.topic,
      cs.question_text,
      cs.student_attempt_text,
      cs.teacher_direction,
      cs.status,
      cs.started_at,
      cs.ended_at
    FROM consultation_sessions cs
    INNER JOIN StudySession ss ON ss.session_id = cs.study_session_id
    INNER JOIN "User" student ON student.user_id = cs.student_user_id
    LEFT JOIN "User" teacher ON teacher.user_id = cs.teacher_user_id
    WHERE cs.study_session_id = $1
      AND cs.id = $2
  `;
  const sessionResult = await executor.query(sessionSql, [sessionId, consultationId]);
  const session = sessionResult.rows[0];
  if (!session) return null;

  const reflectionSql = `
    SELECT
      cr.id,
      cr.consultation_session_id,
      cr.submitted_by_user_id,
      submitter.name AS submitted_by_name,
      cr.student_understood,
      cr.summary_checklist_json,
      cr.additional_notes,
      cr.created_at
    FROM consultation_reflections cr
    INNER JOIN "User" submitter ON submitter.user_id = cr.submitted_by_user_id
    WHERE cr.consultation_session_id = $1
    ORDER BY cr.created_at DESC, cr.id DESC
    LIMIT 1
  `;
  const reflectionResult = await executor.query(reflectionSql, [consultationId]);

  return mapConsultationSession(session, mapConsultationReflection(reflectionResult.rows[0]));
};

module.exports.selectConsultationWorkspace = async function selectConsultationWorkspace(data) {
  const consultationResult = await pool.query(
    `
      SELECT id
      FROM consultation_sessions
      WHERE study_session_id = $1
        AND id = $2
    `,
    [data.study_session_id, data.consultation_session_id],
  );
  if (!consultationResult.rows[0]) return null;

  const noteResult = await pool.query(
    `
      SELECT user_id, note_text, updated_at
      FROM consultation_notes
      WHERE consultation_session_id = $1
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
    `,
    [data.consultation_session_id],
  );

  return mapConsultationWorkspace(noteResult.rows[0]);
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
      LEAST(GREATEST(COALESCE(mgp.progress_percent, 0), 0), 100) AS progress_percent
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
      sm.user_id,
      mg.id,
      mg.title,
      mg.description,
      mg.status,
      mg.queue_position,
      COALESCE(mgp.progress_percent, 0) AS progress_percent,
      (COALESCE(mgp.is_completed, FALSE) OR mg.status = 'completed') AS is_completed,
      COALESCE(mgp.completed_at, mg.completed_at) AS completed_at
    FROM SessionMember sm
    INNER JOIN micro_goals mg ON mg.study_session_id = sm.session_id
    LEFT JOIN micro_goal_progress mgp
      ON mgp.micro_goal_id = mg.id
      AND mgp.user_id = sm.user_id
    WHERE sm.session_id = $1
      AND sm.left_at IS NULL
      AND (mg.id = $2 OR mgp.id IS NOT NULL)
    ORDER BY
      CASE WHEN mg.id = $2 THEN 0 WHEN COALESCE(mgp.is_completed, FALSE) THEN 1 ELSE 2 END,
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

  const creditSql = `
    SELECT
      sm.user_id,
      COALESCE(ss.planned_duration_seconds, ss.duration, 0)::INT AS planned_session_seconds,
      (
        COALESCE(focus_stats.focus_seconds, 0)
        + CASE
            WHEN COALESCE(focus_stats.focus_seconds, 0) = 0
              AND LOWER(REPLACE(COALESCE(sm.status, 'focus'), ' ', '_')) IN ('focus', 'focusing')
            THEN COALESCE(sm.status_timer, 0)
            ELSE 0
          END
      )::INT AS focus_seconds,
      COALESCE(goal_stats.completed_micro_goals, 0)::INT AS completed_micro_goals,
      COALESCE(evidence_stats.evidence_uploads, 0)::INT AS evidence_uploads,
      (
        COALESCE(help_status.help_status_count, 0)
        + COALESCE(consultation_stats.consultation_count, 0)
        + CASE
            WHEN LOWER(REPLACE(COALESCE(sm.status, 'focus'), ' ', '_')) IN ('need_help', 'in_consultation')
            THEN 1
            ELSE 0
          END
      )::INT AS help_participation
    FROM SessionMember sm
    INNER JOIN StudySession ss ON ss.session_id = sm.session_id
    LEFT JOIN LATERAL (
      SELECT COALESCE(
        SUM(
          GREATEST(
            EXTRACT(
              EPOCH FROM (
                COALESCE(se.ended_at, CURRENT_TIMESTAMP)
                - GREATEST(se.started_at, COALESCE(ss.started_at, CURRENT_TIMESTAMP))
              )
            ),
            0
          )
        ),
        0
      )::INT AS focus_seconds
      FROM status_events se
      WHERE se.study_session_participant_id = sm.member_id
        AND LOWER(REPLACE(se.status, ' ', '_')) IN ('focus', 'focusing')
        AND COALESCE(se.ended_at, CURRENT_TIMESTAMP) >= COALESCE(ss.started_at, CURRENT_TIMESTAMP)
    ) focus_stats ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS completed_micro_goals
      FROM micro_goal_progress mgp
      INNER JOIN micro_goals mg ON mg.id = mgp.micro_goal_id
      WHERE mg.study_session_id = sm.session_id
        AND mgp.user_id = sm.user_id
        AND mgp.is_completed = TRUE
    ) goal_stats ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS evidence_uploads
      FROM micro_goal_workings w
      INNER JOIN micro_goal_progress mgp ON mgp.id = w.micro_goal_progress_id
      INNER JOIN micro_goals mg ON mg.id = mgp.micro_goal_id
      WHERE mg.study_session_id = sm.session_id
        AND mgp.user_id = sm.user_id
    ) evidence_stats ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS help_status_count
      FROM status_events se
      WHERE se.study_session_participant_id = sm.member_id
        AND LOWER(REPLACE(se.status, ' ', '_')) IN ('need_help', 'in_consultation')
        AND se.started_at >= COALESCE(ss.started_at, CURRENT_TIMESTAMP)
    ) help_status ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS consultation_count
      FROM consultation_sessions cs
      WHERE cs.study_session_id = sm.session_id
        AND sm.user_id IN (cs.student_user_id, cs.teacher_user_id)
    ) consultation_stats ON TRUE
    WHERE sm.session_id = $1
      AND sm.left_at IS NULL
  `;

  const membersResult = await pool.query(memberSql, [sessionId, microGoalId]);
  const goalsResult = await pool.query(goalSql, [sessionId, microGoalId]);
  const evidenceResult = await pool.query(evidenceSql, [sessionId]);
  const creditResult = await pool.query(creditSql, [sessionId]);

  const evidenceByProgress = groupBy(evidenceResult.rows, 'progress_id');
  const creditByUser = Object.fromEntries(
    creditResult.rows.map((row) => [row.user_id, buildFocusCredit(row)]),
  );
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
    focus_credit: creditByUser[member.user_id] || buildFocusCredit(),
    goals: goalsByUser[member.user_id] || [],
  }));
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

module.exports.selectFocusStatusMix = async function selectFocusStatusMix(sessionId) {
  const SQLSTATEMENT = `
    SELECT
      sm.member_id,
      sm.user_id,
      u.name,
      LOWER(REPLACE(COALESCE(sm.status, 'focus'), ' ', '_')) AS current_status,
      sm.joined_at,
      sm.left_at,
      ss.started_at,
      CURRENT_TIMESTAMP AS captured_at,
      se.id AS event_id,
      se.status AS event_status,
      se.started_at AS event_time,
      se.ended_at AS event_ended_at
    FROM SessionMember sm
    INNER JOIN StudySession ss ON ss.session_id = sm.session_id
    INNER JOIN "User" u ON u.user_id = sm.user_id
    LEFT JOIN status_events se
      ON se.study_session_participant_id = sm.member_id
      AND ss.started_at IS NOT NULL
      AND COALESCE(se.ended_at, CURRENT_TIMESTAMP) >= ss.started_at
    WHERE sm.session_id = $1
      AND sm.left_at IS NULL
    ORDER BY sm.member_id ASC, se.started_at ASC NULLS LAST, se.id ASC NULLS LAST
  `;
  const { rows } = await pool.query(SQLSTATEMENT, [sessionId]);
  const members = groupBy(rows, 'member_id');

  return {
    mode: 'focus_status_mix',
    generated_at: rows[0]?.captured_at || new Date().toISOString(),
    members: Object.values(members).map((memberRows) => {
      const firstRow = memberRows[0];
      const capturedAt = firstRow.captured_at || new Date();
      const events = memberRows
        .filter((row) => row.event_id)
        .sort((a, b) => {
          const timeDiff = dateMs(a.event_time) - dateMs(b.event_time);
          return timeDiff || Number(a.event_id) - Number(b.event_id);
        });
      const sessionStart = firstRow.started_at || null;
      const memberStart = sessionStart
        ? maxDate(sessionStart, firstRow.joined_at) || sessionStart
        : capturedAt;
      const memberEnd = minDate(firstRow.left_at || capturedAt, capturedAt) || capturedAt;
      const totals = focusStatusOrder.reduce((statusTotals, status) => {
        statusTotals[status] = 0;
        return statusTotals;
      }, {});
      let cursor = memberStart;
      let lastStatus = 'focus';

      events.forEach((event) => {
        const eventStatus = normalizeMemberStatus(event.event_status);
        const eventStart = maxDate(event.event_time, memberStart);
        const eventEnd = minDate(event.event_ended_at || memberEnd, memberEnd);

        if (!eventStart || !eventEnd || dateMs(eventEnd) <= dateMs(memberStart)) return;
        if (dateMs(eventStart) >= dateMs(memberEnd)) return;

        if (dateMs(eventStart) > dateMs(cursor)) {
          addStatusSeconds(totals, lastStatus, cursor, eventStart);
        }

        const segmentStart = maxDate(eventStart, cursor, memberStart);
        if (dateMs(eventEnd) > dateMs(segmentStart)) {
          addStatusSeconds(totals, eventStatus, segmentStart, eventEnd);
        }

        if (dateMs(eventEnd) > dateMs(cursor)) cursor = eventEnd;
        lastStatus = eventStatus;
      });

      if (dateMs(memberEnd) > dateMs(cursor)) {
        addStatusSeconds(totals, firstRow.current_status || lastStatus, cursor, memberEnd);
      }

      const segments = buildFocusStatusSegments(totals);
      const totalSeconds = segments.reduce((sum, segment) => sum + segment.seconds, 0);
      const currentStatus = normalizeMemberStatus(firstRow.current_status);

      return {
        user_id: firstRow.user_id,
        name: firstRow.name,
        current_status: prettyStatus(currentStatus),
        current_status_key: currentStatus,
        joined_at: firstRow.joined_at,
        tracked_from: memberStart,
        total_seconds: totalSeconds,
        segments,
      };
    }),
  };
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

module.exports.startConsultation = async function startConsultation(data) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existingSql = `
      SELECT id
      FROM consultation_sessions
      WHERE study_session_id = $1
        AND student_user_id = $2
        AND teacher_user_id = $3
        AND ended_at IS NULL
      ORDER BY started_at DESC, id DESC
      LIMIT 1
    `;
    const existingResult = await client.query(existingSql, [
      data.study_session_id,
      data.student_user_id,
      data.teacher_user_id,
    ]);

    let consultationId = existingResult.rows[0]?.id;

    if (!consultationId) {
      const contextSql = `
        SELECT
          ss.session_id,
          COALESCE(mg.title, ss.micro_goal, ss.title, 'Study consultation') AS topic,
          COALESCE(mg.description, ss.micro_goal, ss.title, 'Clarify the current study task.') AS question_text,
          COALESCE(NULLIF(work.evidence_text, ''), 'No uploaded workings yet.') AS student_attempt_text
        FROM StudySession ss
        INNER JOIN SessionMember sm
          ON sm.session_id = ss.session_id
          AND sm.user_id = $2
          AND sm.left_at IS NULL
        INNER JOIN SessionMember teacher_member
          ON teacher_member.session_id = ss.session_id
          AND teacher_member.user_id = $3
          AND teacher_member.left_at IS NULL
        INNER JOIN "User" teacher ON teacher.user_id = $3
        LEFT JOIN LATERAL (
          SELECT id, title, description
          FROM micro_goals
          WHERE study_session_id = ss.session_id
          ORDER BY
            CASE status WHEN 'active' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
            queue_position ASC,
            id ASC
          LIMIT 1
        ) mg ON TRUE
        LEFT JOIN LATERAL (
          SELECT string_agg(
            CASE
              WHEN w.content_type = 'equation' THEN w.text_content
              ELSE COALESCE(w.text_content, 'Uploaded evidence')
            END,
            E'\n'
            ORDER BY w.created_at ASC, w.id ASC
          ) AS evidence_text
          FROM micro_goal_progress mgp
          INNER JOIN micro_goal_workings w ON w.micro_goal_progress_id = mgp.id
          WHERE mgp.micro_goal_id = mg.id
            AND mgp.user_id = $2
        ) work ON TRUE
        WHERE ss.session_id = $1
      `;
      const contextResult = await client.query(contextSql, [
        data.study_session_id,
        data.student_user_id,
        data.teacher_user_id,
      ]);
      const context = contextResult.rows[0];

      if (!context) {
        await client.query('ROLLBACK');
        return null;
      }

      const insertSql = `
        INSERT INTO consultation_sessions (
          study_session_id,
          student_user_id,
          teacher_user_id,
          topic,
          question_text,
          student_attempt_text,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'active')
        RETURNING id
      `;
      const insertResult = await client.query(insertSql, [
        data.study_session_id,
        data.student_user_id,
        data.teacher_user_id,
        context.topic,
        context.question_text,
        context.student_attempt_text,
      ]);
      consultationId = insertResult.rows[0].id;
    }

    const updatedMembers = await updateMemberStatusesInTransaction(
      client,
      data.study_session_id,
      [data.student_user_id, data.teacher_user_id],
      'in_consultation',
    );
    if (updatedMembers.length < 2) {
      await client.query('ROLLBACK');
      return null;
    }

    const consultation = await selectConsultationDetails(
      client,
      data.study_session_id,
      consultationId,
    );
    await client.query('COMMIT');
    return consultation;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports.finishConsultation = async function finishConsultation(data) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const finishSql = `
      UPDATE consultation_sessions
      SET status = 'completed',
          teacher_direction = COALESCE(NULLIF($3, ''), teacher_direction),
          ended_at = COALESCE(ended_at, CURRENT_TIMESTAMP)
      WHERE study_session_id = $1
        AND id = $2
        AND ended_at IS NULL
      RETURNING id, student_user_id, teacher_user_id
    `;
    const finishResult = await client.query(finishSql, [
      data.study_session_id,
      data.consultation_session_id,
      data.teacher_direction,
    ]);

    if (!finishResult.rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }

    const finishedConsultation = finishResult.rows[0];
    await updateMemberStatusesInTransaction(
      client,
      data.study_session_id,
      [finishedConsultation.student_user_id, finishedConsultation.teacher_user_id],
      'focus',
    );

    const hasReflection =
      data.teacher_direction ||
      data.student_understood !== null ||
      (data.summary_checklist || []).length ||
      data.additional_notes;
    if (hasReflection) {
      await client.query(
        `
          INSERT INTO consultation_reflections (
            consultation_session_id,
            submitted_by_user_id,
            student_understood,
            summary_checklist_json,
            additional_notes
          )
          VALUES ($1, $2, $3, $4::jsonb, $5)
        `,
        [
          data.consultation_session_id,
          data.submitted_by_user_id,
          data.student_understood,
          JSON.stringify(data.summary_checklist || []),
          data.additional_notes || null,
        ],
      );
    }

    const consultation = await selectConsultationDetails(
      client,
      data.study_session_id,
      data.consultation_session_id,
    );
    const reviewNotification = await insertNotification(client, {
      user_id: consultation.teacher_user_id,
      title: 'Consultation ended',
      message: `Add a direction or next step for ${consultation.student_name || 'the student'}.`,
      type: 'info',
      nav_target: 'study-session',
    });

    await client.query('COMMIT');
    return { ...consultation, review_notification: reviewNotification };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports.saveConsultationWorkspace = async function saveConsultationWorkspace(data) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const consultationResult = await client.query(
      `
        SELECT id
        FROM consultation_sessions
        WHERE study_session_id = $1
          AND id = $2
          AND $3 IN (student_user_id, teacher_user_id)
      `,
      [data.study_session_id, data.consultation_session_id, data.user_id],
    );

    if (!consultationResult.rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }

    const payload = JSON.stringify({
      whiteboard_strokes: Array.isArray(data.whiteboard_strokes) ? data.whiteboard_strokes : [],
      scratchpad_text: data.scratchpad_text || '',
    });
    const existingResult = await client.query(
      `
        SELECT id
        FROM consultation_notes
        WHERE consultation_session_id = $1
        ORDER BY updated_at DESC, id DESC
        LIMIT 1
        FOR UPDATE
      `,
      [data.consultation_session_id],
    );

    const noteResult = existingResult.rows[0]
      ? await client.query(
          `
            UPDATE consultation_notes
            SET user_id = $2,
                note_text = $3,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING user_id, note_text, updated_at
          `,
          [existingResult.rows[0].id, data.user_id, payload],
        )
      : await client.query(
          `
            INSERT INTO consultation_notes (consultation_session_id, user_id, note_text)
            VALUES ($1, $2, $3)
            RETURNING user_id, note_text, updated_at
          `,
          [data.consultation_session_id, data.user_id, payload],
        );

    await client.query('COMMIT');
    return mapConsultationWorkspace(noteResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports.saveConsultationReview = async function saveConsultationReview(data) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const updateResult = await client.query(
      `
        UPDATE consultation_sessions
        SET teacher_direction = $3
        WHERE study_session_id = $1
          AND id = $2
        RETURNING id
      `,
      [data.study_session_id, data.consultation_session_id, data.teacher_direction],
    );

    if (!updateResult.rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }

    await client.query(
      `
        INSERT INTO consultation_reflections (
          consultation_session_id,
          submitted_by_user_id,
          student_understood,
          summary_checklist_json,
          additional_notes
        )
        VALUES ($1, $2, NULL, $3::jsonb, NULL)
      `,
      [
        data.consultation_session_id,
        data.submitted_by_user_id,
        JSON.stringify(data.summary_checklist || []),
      ],
    );

    const consultation = await selectConsultationDetails(
      client,
      data.study_session_id,
      data.consultation_session_id,
    );
    const studentNotification = await insertNotification(client, {
      user_id: consultation.student_user_id,
      title: 'Direction / next step',
      message: data.teacher_direction,
      type: 'success',
      nav_target: 'study-session',
    });

    await client.query('COMMIT');
    return { ...consultation, student_notification: studentNotification };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
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
  const evidenceItems = Array.isArray(data.evidence_items) ? data.evidence_items : [data];
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const goalResult = await client.query(
      `
        SELECT id, status
        FROM micro_goals
        WHERE id = $1
          AND study_session_id = $2
        FOR UPDATE
      `,
      [data.micro_goal_id, data.study_session_id],
    );
    const goal = goalResult.rows[0];

    if (!goal) {
      await client.query('ROLLBACK');
      return null;
    }

    if (goal.status !== 'active') {
      throw makeError(409, 'This micro-goal is already completed or not active');
    }

    const progressSql = `
      INSERT INTO micro_goal_progress (
        micro_goal_id,
        user_id,
        progress_percent,
        is_completed,
        completed_at
      )
      VALUES ($1, $2, 100, TRUE, CURRENT_TIMESTAMP)
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
    const savedEvidence = [];

    for (const evidenceItem of evidenceItems) {
      const evidenceResult = await client.query(evidenceSql, [
        progress.id,
        evidenceItem.content_type,
        evidenceItem.text_content || null,
        evidenceItem.image_url || null,
      ]);
      savedEvidence.push(evidenceResult.rows[0]);
    }

    await client.query(
      `
        UPDATE micro_goals
        SET status = 'completed',
            completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP)
        WHERE id = $1
      `,
      [data.micro_goal_id],
    );

    const nextGoalResult = await client.query(
      `
        UPDATE micro_goals
        SET status = 'active',
            activated_at = COALESCE(activated_at, CURRENT_TIMESTAMP)
        WHERE id = (
          SELECT id
          FROM micro_goals
          WHERE study_session_id = $1
            AND status = 'pending'
          ORDER BY queue_position ASC, id ASC
          LIMIT 1
        )
        RETURNING id
      `,
      [data.study_session_id],
    );

    if (nextGoalResult.rows.length) {
      await client.query(
        `
          UPDATE SessionMember
          SET progress = 0
          WHERE session_id = $1
            AND left_at IS NULL
        `,
        [data.study_session_id],
      );
    } else {
      await client.query(
        `
          UPDATE SessionMember
          SET progress = GREATEST(progress, 100)
          WHERE session_id = $1
            AND user_id = $2
            AND left_at IS NULL
        `,
        [data.study_session_id, data.user_id],
      );
    }

    await client.query('COMMIT');
    return savedEvidence;
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
        AND status = 'active'
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
  const normalizedStatus = normalizeMemberStatus(data.status);
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
        UPDATE StudySession
        SET started_at = COALESCE(started_at, CURRENT_TIMESTAMP)
        WHERE session_id = $1
      `,
      [data.study_session_id],
    );

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
