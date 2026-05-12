const express = require('express');
const router = express.Router();
const studySessionController = require('../controllers/StudySession.controller');

// ##############################################################
// FEATURE: Study Session Page
// ##############################################################

router.get('/:sessionId', studySessionController.getSession);
router.get('/:sessionId/members', studySessionController.getMembers);
router.get('/:sessionId/micro-goals', studySessionController.getMicroGoals);
router.post('/:sessionId/micro-goals', studySessionController.addMicroGoal);
router.patch('/:sessionId/exit', studySessionController.exitSession);

module.exports = router;
