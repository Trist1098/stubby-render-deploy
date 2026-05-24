const model = require('../models/StudySession.model');
const { checkWorkWithAi } = require('../services/workCheckAi.service');
const { badReq, created, notFound, ok } = require('../utils/responseHelpers');
const mammoth = require('mammoth');

const parseId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const getLoggedInUserId = (res) => parseId(res.locals.userId);

const getSessionUserIds = (req, res) => {
  const sessionId = parseId(req.params.sessionId);
  const userId = getLoggedInUserId(res);

  if (!sessionId) {
    badReq(res, 'Valid session id is required');
    return null;
  }
  if (!userId) {
    badReq(res, 'Valid user id is required');
    return null;
  }

  return { sessionId, userId };
};

const getTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '');
const docxMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const isTxtFile = (file) =>
  /\.txt$/i.test(file.originalname) &&
  (!file.mimetype ||
    file.mimetype === 'text/plain' ||
    file.mimetype === 'application/octet-stream');

const isDocxFile = (file) =>
  /\.docx$/i.test(file.originalname) &&
  (!file.mimetype ||
    file.mimetype === docxMimeType ||
    file.mimetype === 'application/octet-stream');

const getWorkCheckFile = async (file) => {
  if (!file) return {};
  if (isTxtFile(file)) {
    return {
      fileName: file.originalname,
      fileType: 'text',
      fileText: file.buffer.toString('utf8'),
    };
  }
  if (isDocxFile(file)) {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return {
      fileName: file.originalname,
      fileType: 'docx',
      fileText: result.value,
    };
  }
  return {};
};

const getStringList = (value) =>
  Array.isArray(value) ? value.map(getTrimmedString).filter(Boolean) : [];

const clampUnit = (value) => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return null;
  return Math.min(Math.max(numberValue, 0), 1);
};

const getWhiteboardStrokes = (value) => {
  if (!Array.isArray(value)) return [];

  return value
    .slice(-250)
    .map((stroke) => {
      const points = Array.isArray(stroke?.points)
        ? stroke.points
            .slice(0, 500)
            .map((point) => {
              const x = clampUnit(point?.x);
              const y = clampUnit(point?.y);
              return x === null || y === null ? null : { x, y };
            })
            .filter(Boolean)
        : [];

      if (!points.length) return null;

      const width = Number(stroke.width);
      const color = /^#[0-9a-f]{6}$/i.test(stroke.color) ? stroke.color : '#111827';
      return {
        color,
        width: Number.isFinite(width) ? Math.min(Math.max(width, 1), 12) : 3,
        points,
      };
    })
    .filter(Boolean);
};

module.exports.getSession = async function getSession(req, res, next) {
  const sessionId = parseId(req.params.sessionId);
  const userId = getLoggedInUserId(res);
  if (!sessionId) return badReq(res, 'Valid session id is required');
  if (!userId) return badReq(res, 'Valid user id is required');

  try {
    const access = await model.ensureSessionAccessForUser(sessionId, userId);
    if (!access) return res.status(403).json({ error: 'You are not invited to this study session' });

    await model.expireSessionIfTimeElapsed(sessionId);
    await model.ensureActiveSessionTimers(sessionId);
    const session = await model.selectSessionById(sessionId);
    if (!session) return notFound(res, 'Study session not found');

    const microGoal = await model.selectCurrentMicroGoal(sessionId);
    const queuedMicroGoals = await model.selectQueuedMicroGoals(sessionId, microGoal?.id);
    const members = await model.selectSessionMembers(sessionId, microGoal?.id);

    return ok(res, {
      ...session,
      micro_goal: microGoal,
      queued_micro_goals: queuedMicroGoals,
      members,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports.listSessions = async function listSessions(req, res, next) {
  const userId = getLoggedInUserId(res);
  if (!userId) return badReq(res, 'Valid user id is required');

  try {
    await model.syncScheduledOnlineSessionsForUser(userId);

    const sessionsBeforeSync = await model.selectSessionsForUser(userId);
    const activeSessionIds = sessionsBeforeSync
      .filter((session) => session.status === 'active')
      .map((session) => session.id);

    await Promise.all(
      activeSessionIds.map((sessionId) => model.expireSessionIfTimeElapsed(sessionId)),
    );
    const sessionsAfterExpiry = await model.selectSessionsForUser(userId);
    await Promise.all(
      sessionsAfterExpiry
        .filter((session) => session.status === 'active')
        .map((session) => model.ensureActiveSessionTimers(session.id)),
    );

    const sessions = [
      ...(await model.selectSessionsForUser(userId)),
      ...(await model.selectUpcomingScheduledSessionsForUser(userId)),
    ].sort((left, right) => {
      const statusOrder = { active: 0, upcoming: 1, expired: 2, completed: 3 };
      const leftOrder = statusOrder[left.status] ?? 4;
      const rightOrder = statusOrder[right.status] ?? 4;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;

      const leftTime = new Date(
        left.scheduled_start_at || left.started_at || left.captured_at || 0,
      ).getTime();
      const rightTime = new Date(
        right.scheduled_start_at || right.started_at || right.captured_at || 0,
      ).getTime();
      return leftOrder === 1 ? leftTime - rightTime : rightTime - leftTime;
    });
    return ok(res, sessions);
  } catch (error) {
    return next(error);
  }
};

module.exports.addMicroGoal = async function addMicroGoal(req, res, next) {
  const sessionId = parseId(req.params.sessionId);
  const title = getTrimmedString(req.body.title);
  const description = getTrimmedString(req.body.description);
  const createdByUserId = getLoggedInUserId(res);

  if (!sessionId) return badReq(res, 'Valid session id is required');
  if (!title) return badReq(res, 'Micro-goal title is required');
  if (!description) return badReq(res, 'Question or task is required');

  try {
    const goal = await model.insertMicroGoal({
      study_session_id: sessionId,
      created_by_user_id: createdByUserId,
      title,
      description,
    });

    if (!goal) return notFound(res, 'Study session not found');
    return created(res, goal);
  } catch (error) {
    return next(error);
  }
};

module.exports.addMicroGoalEvidence = async function addMicroGoalEvidence(req, res, next) {
  const sessionId = parseId(req.params.sessionId);
  const microGoalId = parseId(req.params.microGoalId);
  const userId = getLoggedInUserId(res);
  const equationText = getTrimmedString(req.body.equation_text);

  if (!sessionId) return badReq(res, 'Valid session id is required');
  if (!microGoalId) return badReq(res, 'Valid micro-goal id is required');
  if (!userId) return badReq(res, 'Valid user id is required');
  if (!equationText && !req.file) {
    return badReq(res, 'Add written equations, a .txt file, or a Word .docx file before uploading');
  }

  try {
    const baseEvidence = {
      study_session_id: sessionId,
      micro_goal_id: microGoalId,
      user_id: userId,
    };
    const evidencePayloads = [
      equationText && {
        ...baseEvidence,
        content_type: 'equation',
        text_content: equationText,
      },
      req.file && {
        ...baseEvidence,
        content_type: 'file',
        text_content: req.file.originalname,
        image_url: `/uploads/${req.file.filename}`,
      },
    ].filter(Boolean);

    const savedEvidence = await model.insertMicroGoalEvidence({
      ...baseEvidence,
      evidence_items: evidencePayloads,
    });
    if (!savedEvidence?.length) return notFound(res, 'Micro-goal not found');

    return created(res, savedEvidence);
  } catch (error) {
    return next(error);
  }
};

module.exports.checkMicroGoalWork = async function checkMicroGoalWork(req, res, next) {
  const sessionId = parseId(req.params.sessionId);
  const microGoalId = parseId(req.params.microGoalId);
  const userId = getLoggedInUserId(res);
  const equationText = getTrimmedString(req.body.equation_text);

  if (!sessionId) return badReq(res, 'Valid session id is required');
  if (!microGoalId) return badReq(res, 'Valid micro-goal id is required');
  if (!userId) return badReq(res, 'Valid user id is required');
  if (!equationText && !req.file) {
    return badReq(
      res,
      'Add written equations, a .txt file, or a Word .docx file before checking work',
    );
  }

  try {
    const workCheckFile = await getWorkCheckFile(req.file);
    if (req.file && !workCheckFile.fileType) {
      return badReq(res, 'AI work check supports .txt or Word .docx files only');
    }
    if (workCheckFile.fileType === 'docx' && !getTrimmedString(workCheckFile.fileText)) {
      return badReq(res, 'The Word document does not contain readable text');
    }

    const microGoal = await model.selectMicroGoalById(sessionId, microGoalId);
    if (!microGoal) return notFound(res, 'Micro-goal not found');
    if (microGoal.status !== 'active') {
      return res.status(409).json({ error: 'This micro-goal is already completed or not active' });
    }

    const feedback = await checkWorkWithAi({
      microGoal,
      equationText,
      fileText: workCheckFile.fileText || '',
      fileName: workCheckFile.fileName || '',
    });

    const savedFeedback = await model.insertMicroGoalAiCheck({
      study_session_id: sessionId,
      micro_goal_id: microGoalId,
      user_id: userId,
      equation_text: equationText,
      file_name: workCheckFile.fileName,
      file_type: workCheckFile.fileType,
      ...feedback,
    });

    if (!savedFeedback) return notFound(res, 'Micro-goal not found');
    return ok(res, savedFeedback);
  } catch (error) {
    return next(error);
  }
};

module.exports.getMicroGoalWorkChecks = async function getMicroGoalWorkChecks(req, res, next) {
  const sessionId = parseId(req.params.sessionId);
  const microGoalId = parseId(req.params.microGoalId);
  const userId = getLoggedInUserId(res);

  if (!sessionId) return badReq(res, 'Valid session id is required');
  if (!microGoalId) return badReq(res, 'Valid micro-goal id is required');
  if (!userId) return badReq(res, 'Valid user id is required');

  try {
    const feedback = await model.selectMicroGoalAiChecks({
      study_session_id: sessionId,
      micro_goal_id: microGoalId,
      user_id: userId,
    });

    return ok(res, feedback);
  } catch (error) {
    return next(error);
  }
};

module.exports.getFocusStatusMix = async function getFocusStatusMix(req, res, next) {
  const sessionId = parseId(req.params.sessionId);
  if (!sessionId) return badReq(res, 'Valid session id is required');

  try {
    await model.expireSessionIfTimeElapsed(sessionId);
    const statusMix = await model.selectFocusStatusMix(sessionId);
    return ok(res, statusMix);
  } catch (error) {
    return next(error);
  }
};

module.exports.startConsultation = async function startConsultation(req, res, next) {
  const sessionId = parseId(req.params.sessionId);
  const studentUserId = parseId(req.body.student_user_id);
  const teacherUserId = getLoggedInUserId(res);

  if (!sessionId) return badReq(res, 'Valid session id is required');
  if (!studentUserId) return badReq(res, 'Valid student user id is required');
  if (!teacherUserId) return badReq(res, 'Valid teacher user id is required');
  if (studentUserId === teacherUserId) {
    return badReq(res, 'Consultation requires two different users');
  }

  try {
    const consultation = await model.startConsultation({
      study_session_id: sessionId,
      student_user_id: studentUserId,
      teacher_user_id: teacherUserId,
    });

    if (!consultation) return notFound(res, 'Study session member or teacher not found');
    return created(res, consultation);
  } catch (error) {
    return next(error);
  }
};

module.exports.finishConsultation = async function finishConsultation(req, res, next) {
  const sessionId = parseId(req.params.sessionId);
  const consultationId = parseId(req.params.consultationId);
  const submittedByUserId = getLoggedInUserId(res);
  const teacherDirection = getTrimmedString(req.body.teacher_direction);
  const additionalNotes = getTrimmedString(req.body.additional_notes);
  const summaryChecklist = getStringList(req.body.summary_checklist);
  const studentUnderstood =
    typeof req.body.student_understood === 'boolean' ? req.body.student_understood : null;

  if (!sessionId) return badReq(res, 'Valid session id is required');
  if (!consultationId) return badReq(res, 'Valid consultation id is required');
  if (!submittedByUserId) return badReq(res, 'Valid submitter user id is required');

  try {
    const consultation = await model.finishConsultation({
      study_session_id: sessionId,
      consultation_session_id: consultationId,
      submitted_by_user_id: submittedByUserId,
      teacher_direction: teacherDirection,
      student_understood: studentUnderstood,
      summary_checklist: summaryChecklist,
      additional_notes: additionalNotes,
    });

    if (!consultation) return notFound(res, 'Open consultation not found');
    return ok(res, consultation);
  } catch (error) {
    return next(error);
  }
};

module.exports.saveConsultationReview = async function saveConsultationReview(req, res, next) {
  const sessionId = parseId(req.params.sessionId);
  const consultationId = parseId(req.params.consultationId);
  const submittedByUserId = getLoggedInUserId(res);
  const teacherDirection = getTrimmedString(req.body.teacher_direction);
  const summaryChecklist = getStringList(req.body.summary_checklist);

  if (!sessionId) return badReq(res, 'Valid session id is required');
  if (!consultationId) return badReq(res, 'Valid consultation id is required');
  if (!submittedByUserId) return badReq(res, 'Valid submitter user id is required');
  if (!teacherDirection) return badReq(res, 'Direction or next step is required');

  try {
    const consultation = await model.saveConsultationReview({
      study_session_id: sessionId,
      consultation_session_id: consultationId,
      submitted_by_user_id: submittedByUserId,
      teacher_direction: teacherDirection,
      summary_checklist: summaryChecklist,
    });

    if (!consultation) return notFound(res, 'Consultation not found');
    return ok(res, consultation);
  } catch (error) {
    return next(error);
  }
};

module.exports.getConsultationWorkspace = async function getConsultationWorkspace(req, res, next) {
  const sessionId = parseId(req.params.sessionId);
  const consultationId = parseId(req.params.consultationId);

  if (!sessionId) return badReq(res, 'Valid session id is required');
  if (!consultationId) return badReq(res, 'Valid consultation id is required');

  try {
    const workspace = await model.selectConsultationWorkspace({
      study_session_id: sessionId,
      consultation_session_id: consultationId,
    });

    if (!workspace) return notFound(res, 'Consultation not found');
    return ok(res, workspace);
  } catch (error) {
    return next(error);
  }
};

module.exports.saveConsultationWorkspace = async function saveConsultationWorkspace(
  req,
  res,
  next,
) {
  const sessionId = parseId(req.params.sessionId);
  const consultationId = parseId(req.params.consultationId);
  const userId = getLoggedInUserId(res);
  const scratchpadText =
    typeof req.body.scratchpad_text === 'string' ? req.body.scratchpad_text : '';
  const whiteboardStrokes = getWhiteboardStrokes(req.body.whiteboard_strokes);

  if (!sessionId) return badReq(res, 'Valid session id is required');
  if (!consultationId) return badReq(res, 'Valid consultation id is required');
  if (!userId) return badReq(res, 'Valid user id is required');

  try {
    const workspace = await model.saveConsultationWorkspace({
      study_session_id: sessionId,
      consultation_session_id: consultationId,
      user_id: userId,
      scratchpad_text: scratchpadText,
      whiteboard_strokes: whiteboardStrokes,
    });

    if (!workspace) return notFound(res, 'Consultation member not found');
    return ok(res, workspace);
  } catch (error) {
    return next(error);
  }
};

module.exports.openMemberChat = async function openMemberChat(req, res, next) {
  const sessionId = parseId(req.params.sessionId);
  const userId = getLoggedInUserId(res);
  const otherUserId = parseId(req.params.memberUserId);

  if (!sessionId) return badReq(res, 'Valid session id is required');
  if (!userId) return badReq(res, 'Valid user id is required');
  if (!otherUserId) return badReq(res, 'Valid member user id is required');
  if (userId === otherUserId) return badReq(res, 'Chat requires two different users');

  try {
    const chat = await model.ensureSessionMemberChat({
      study_session_id: sessionId,
      user_id: userId,
      other_user_id: otherUserId,
    });

    if (!chat) return notFound(res, 'Study session member not found');
    return ok(res, chat);
  } catch (error) {
    return next(error);
  }
};

module.exports.openSessionGroupChat = async function openSessionGroupChat(req, res, next) {
  const sessionId = parseId(req.params.sessionId);
  const userId = getLoggedInUserId(res);

  if (!sessionId) return badReq(res, 'Valid session id is required');
  if (!userId) return badReq(res, 'Valid user id is required');

  try {
    const access = await model.ensureSessionAccessForUser(sessionId, userId);
    if (!access) return res.status(403).json({ error: 'You are not invited to this study session' });

    const chat = await model.ensureSessionGroupChat({
      study_session_id: sessionId,
      user_id: userId,
    });

    if (!chat) return notFound(res, 'Study session members not found');
    return ok(res, chat);
  } catch (error) {
    return next(error);
  }
};

module.exports.updateMicroGoalProgress = async function updateMicroGoalProgress(req, res, next) {
  const sessionId = parseId(req.params.sessionId);
  const microGoalId = parseId(req.params.microGoalId);
  const userId = getLoggedInUserId(res);
  const progress = Number(req.body.progress_percent);

  if (!sessionId) return badReq(res, 'Valid session id is required');
  if (!microGoalId) return badReq(res, 'Valid micro-goal id is required');
  if (!userId) return badReq(res, 'Valid user id is required');
  if (!Number.isInteger(progress) || progress < 0 || progress > 99) {
    return badReq(res, 'Progress must be between 0 and 99 before uploading workings');
  }

  try {
    const updatedProgress = await model.updateMicroGoalProgress({
      study_session_id: sessionId,
      micro_goal_id: microGoalId,
      user_id: userId,
      progress_percent: progress,
    });

    if (!updatedProgress) return notFound(res, 'Micro-goal progress is locked or unavailable');
    return ok(res, updatedProgress);
  } catch (error) {
    return next(error);
  }
};

module.exports.updateMemberStatus = async function updateMemberStatus(req, res, next) {
  const sessionId = parseId(req.params.sessionId);
  const userId = getLoggedInUserId(res);
  const status = getTrimmedString(req.body.status).toLowerCase();

  if (!sessionId) return badReq(res, 'Valid session id is required');
  if (!userId) return badReq(res, 'Valid user id is required');
  if (!status) return badReq(res, 'Status is required');

  try {
    const member = await model.updateMemberStatus({
      study_session_id: sessionId,
      user_id: userId,
      status,
    });

    if (!member) return notFound(res, 'Session member not found or status is invalid');
    return ok(res, member);
  } catch (error) {
    return next(error);
  }
};

module.exports.updateMemberMission = async function updateMemberMission(req, res, next) {
  const sessionId = parseId(req.params.sessionId);
  const userId = getLoggedInUserId(res);
  const mission = getTrimmedString(req.body.mission).slice(0, 180);

  if (!sessionId) return badReq(res, 'Valid session id is required');
  if (!userId) return badReq(res, 'Valid user id is required');
  if (!mission) return badReq(res, 'Mission is required');

  try {
    const access = await model.ensureSessionAccessForUser(sessionId, userId);
    if (!access) return res.status(403).json({ error: 'You are not invited to this study session' });

    const member = await model.updateMemberMission({
      study_session_id: sessionId,
      user_id: userId,
      mission,
    });

    if (!member) return notFound(res, 'Session member not found');
    return ok(res, member);
  } catch (error) {
    return next(error);
  }
};

module.exports.exitSession = async function exitSession(req, res, next) {
  const sessionId = parseId(req.params.sessionId);
  if (!sessionId) return badReq(res, 'Valid session id is required');

  try {
    const session = await model.exitSession(sessionId);
    if (!session) return notFound(res, 'Study session not found');

    return ok(res, session);
  } catch (error) {
    return next(error);
  }
};

module.exports.extendExpiredSession = async function extendExpiredSession(req, res, next) {
  const ids = getSessionUserIds(req, res);
  const extensionSeconds = Number(req.body.extension_seconds);

  if (!ids) return null;
  if (!Number.isFinite(extensionSeconds) || extensionSeconds < 60) {
    return badReq(res, 'Extension must be at least 1 minute');
  }

  try {
    await model.expireSessionIfTimeElapsed(ids.sessionId);
    const result = await model.extendExpiredSession({
      study_session_id: ids.sessionId,
      user_id: ids.userId,
      extension_seconds: extensionSeconds,
    });

    if (!result) return notFound(res, 'Expired session or active member not found');
    return ok(res, result);
  } catch (error) {
    return next(error);
  }
};

module.exports.stayInExtendedSession = async function stayInExtendedSession(req, res, next) {
  const ids = getSessionUserIds(req, res);
  if (!ids) return null;

  try {
    const member = await model.stayInExtendedSession({
      study_session_id: ids.sessionId,
      user_id: ids.userId,
    });

    if (!member) return notFound(res, 'Active session or member not found');
    return ok(res, member);
  } catch (error) {
    return next(error);
  }
};

module.exports.leaveSessionMember = async function leaveSessionMember(req, res, next) {
  const ids = getSessionUserIds(req, res);
  if (!ids) return null;

  try {
    const member = await model.leaveSessionMember({
      study_session_id: ids.sessionId,
      user_id: ids.userId,
    });

    if (!member) return notFound(res, 'Active session member not found');
    return ok(res, member);
  } catch (error) {
    return next(error);
  }
};
