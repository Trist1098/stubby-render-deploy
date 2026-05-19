const express = require('express');
const router = express.Router();
const studySessionController = require('../controllers/StudySession.controller');
const upload = require('../middlewares/upload');

router.get('/:sessionId', studySessionController.getSession);
router.post('/:sessionId/consultations', studySessionController.startConsultation);
router.patch(
  '/:sessionId/consultations/:consultationId/finish',
  studySessionController.finishConsultation,
);
router.patch(
  '/:sessionId/consultations/:consultationId/review',
  studySessionController.saveConsultationReview,
);
router.post('/:sessionId/micro-goals', studySessionController.addMicroGoal);
router.post(
  '/:sessionId/micro-goals/:microGoalId/evidence',
  upload.single('evidence_file'),
  studySessionController.addMicroGoalEvidence,
);
router.post(
  '/:sessionId/micro-goals/:microGoalId/work-check',
  upload.memoryWorkCheck.single('evidence_file'),
  studySessionController.checkMicroGoalWork,
);
router.get(
  '/:sessionId/micro-goals/:microGoalId/work-checks',
  studySessionController.getMicroGoalWorkChecks,
);
router.patch(
  '/:sessionId/micro-goals/:microGoalId/progress',
  studySessionController.updateMicroGoalProgress,
);
router.patch('/:sessionId/members/status', studySessionController.updateMemberStatus);
router.patch('/:sessionId/exit', studySessionController.exitSession);

module.exports = router;
