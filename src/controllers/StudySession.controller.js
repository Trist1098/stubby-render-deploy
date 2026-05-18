const model = require('../models/StudySession.model');
const { checkWorkWithAi } = require('../services/workCheckAi.service');
const { badReq, created, notFound, ok } = require('../utils/responseHelpers');
const mammoth = require('mammoth');

const parseId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const getTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '');
const docxMimeType =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const isTxtFile = (file) =>
  /\.txt$/i.test(file.originalname) &&
  (!file.mimetype || file.mimetype === 'text/plain' || file.mimetype === 'application/octet-stream');

const isDocxFile = (file) =>
  /\.docx$/i.test(file.originalname) &&
  (!file.mimetype || file.mimetype === docxMimeType || file.mimetype === 'application/octet-stream');

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

module.exports.getSession = async function getSession(req, res, next) {
  const sessionId = parseId(req.params.sessionId);
  if (!sessionId) return badReq(res, 'Valid session id is required');

  try {
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

module.exports.getMembers = async function getMembers(req, res, next) {
  const sessionId = parseId(req.params.sessionId);
  if (!sessionId) return badReq(res, 'Valid session id is required');

  try {
    const microGoal = await model.selectCurrentMicroGoal(sessionId);
    const members = await model.selectSessionMembers(sessionId, microGoal?.id);
    return ok(res, members);
  } catch (error) {
    return next(error);
  }
};

module.exports.getMicroGoals = async function getMicroGoals(req, res, next) {
  const sessionId = parseId(req.params.sessionId);
  if (!sessionId) return badReq(res, 'Valid session id is required');

  try {
    const goals = await model.selectMicroGoalsBySessionId(sessionId);
    return ok(res, goals);
  } catch (error) {
    return next(error);
  }
};

module.exports.addMicroGoal = async function addMicroGoal(req, res, next) {
  const sessionId = parseId(req.params.sessionId);
  const title = getTrimmedString(req.body.title);
  const createdByUserId = parseId(req.body.created_by_user_id);

  if (!sessionId) return badReq(res, 'Valid session id is required');
  if (!title) return badReq(res, 'Micro-goal title is required');

  try {
    const goal = await model.insertMicroGoal({
      study_session_id: sessionId,
      created_by_user_id: createdByUserId,
      title,
      description: req.body.description,
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
  const userId = parseId(req.body.user_id);
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

    const savedEvidence = (
      await Promise.all(evidencePayloads.map(model.insertMicroGoalEvidence))
    ).filter(Boolean);
    if (!savedEvidence.length) return notFound(res, 'Micro-goal not found');

    return created(res, savedEvidence);
  } catch (error) {
    return next(error);
  }
};

module.exports.checkMicroGoalWork = async function checkMicroGoalWork(req, res, next) {
  const sessionId = parseId(req.params.sessionId);
  const microGoalId = parseId(req.params.microGoalId);
  const userId = parseId(req.body.user_id);
  const equationText = getTrimmedString(req.body.equation_text);

  if (!sessionId) return badReq(res, 'Valid session id is required');
  if (!microGoalId) return badReq(res, 'Valid micro-goal id is required');
  if (!userId) return badReq(res, 'Valid user id is required');
  if (!equationText && !req.file) {
    return badReq(res, 'Add written equations, a .txt file, or a Word .docx file before checking work');
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
  const userId = parseId(req.query.user_id);

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

module.exports.updateMicroGoalProgress = async function updateMicroGoalProgress(req, res, next) {
  const sessionId = parseId(req.params.sessionId);
  const microGoalId = parseId(req.params.microGoalId);
  const userId = parseId(req.body.user_id);
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
  const userId = parseId(req.body.user_id);
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
