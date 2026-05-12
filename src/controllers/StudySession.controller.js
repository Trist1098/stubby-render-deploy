const model = require('../models/StudySession.model');

const parseId = (value) => {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
};

module.exports.getSession = async function getSession(req, res, next) {
    const sessionId = parseId(req.params.sessionId);
    if (!sessionId) return res.status(400).json({ error: 'Valid session id is required' });

    try {
        const session = await model.selectSessionById(sessionId);
        if (!session) return res.status(404).json({ error: 'Study session not found' });

        const microGoal = await model.selectCurrentMicroGoal(sessionId);
        const queuedMicroGoals = await model.selectQueuedMicroGoals(sessionId, microGoal?.id);
        const members = await model.selectSessionMembers(sessionId, microGoal?.id);

        return res.status(200).json({
            data: {
                ...session,
                micro_goal: microGoal,
                queued_micro_goals: queuedMicroGoals,
                members,
            },
        });
    } catch (error) {
        return next(error);
    }
};

module.exports.getMembers = async function getMembers(req, res, next) {
    const sessionId = parseId(req.params.sessionId);
    if (!sessionId) return res.status(400).json({ error: 'Valid session id is required' });

    try {
        const microGoal = await model.selectCurrentMicroGoal(sessionId);
        const members = await model.selectSessionMembers(sessionId, microGoal?.id);
        return res.status(200).json({ data: members });
    } catch (error) {
        return next(error);
    }
};

module.exports.getMicroGoals = async function getMicroGoals(req, res, next) {
    const sessionId = parseId(req.params.sessionId);
    if (!sessionId) return res.status(400).json({ error: 'Valid session id is required' });

    try {
        const goals = await model.selectMicroGoalsBySessionId(sessionId);
        return res.status(200).json({ data: goals });
    } catch (error) {
        return next(error);
    }
};

module.exports.addMicroGoal = async function addMicroGoal(req, res, next) {
    const sessionId = parseId(req.params.sessionId);
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const createdByUserId = parseId(req.body.created_by_user_id);

    if (!sessionId) return res.status(400).json({ error: 'Valid session id is required' });
    if (!title) return res.status(400).json({ error: 'Micro-goal title is required' });

    try {
        const goal = await model.insertMicroGoal({
            study_session_id: sessionId,
            created_by_user_id: createdByUserId,
            title,
            description: req.body.description,
        });

        if (!goal) return res.status(404).json({ error: 'Study session not found' });
        return res.status(201).json({ data: goal });
    } catch (error) {
        return next(error);
    }
};

module.exports.exitSession = async function exitSession(req, res, next) {
    const sessionId = parseId(req.params.sessionId);
    if (!sessionId) return res.status(400).json({ error: 'Valid session id is required' });

    try {
        const session = await model.exitSession(sessionId);
        if (!session) return res.status(404).json({ error: 'Study session not found' });

        return res.status(200).json({ data: session });
    } catch (error) {
        return next(error);
    }
};
