const express = require('express');
const router = express.Router();
const studySessionController = require('../controllers/StudySession.controller');
const upload = require('../middlewares/upload');

router.get('/:sessionId', studySessionController.getSession);
router.get('/:sessionId/members', studySessionController.getMembers);
router.get('/:sessionId/micro-goals', studySessionController.getMicroGoals);
router.post('/:sessionId/micro-goals', studySessionController.addMicroGoal);
router.post(
  '/:sessionId/micro-goals/:microGoalId/evidence',
  upload.single('evidence_file'),
  studySessionController.addMicroGoalEvidence,
);
router.patch(
  '/:sessionId/micro-goals/:microGoalId/progress',
  studySessionController.updateMicroGoalProgress,
);
router.patch('/:sessionId/members/status', studySessionController.updateMemberStatus);
router.patch('/:sessionId/exit', studySessionController.exitSession);

module.exports = router;
