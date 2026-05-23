const express = require('express');
const router = express.Router();
const studySessionController = require('../controllers/StudySession.controller');
const jwtMiddleware = require('../middlewares/jwt.middleware');
const upload = require('../middlewares/upload');

router.use(jwtMiddleware.verifyToken);

router.get('/:sessionId', studySessionController.getSession);
router.get('/:sessionId/focus-status-mix', studySessionController.getFocusStatusMix);
router.post('/:sessionId/consultations', studySessionController.startConsultation);
router.patch(
  '/:sessionId/consultations/:consultationId/finish',
  studySessionController.finishConsultation,
);
router.patch(
  '/:sessionId/consultations/:consultationId/review',
  studySessionController.saveConsultationReview,
);
router.get(
  '/:sessionId/consultations/:consultationId/workspace',
  studySessionController.getConsultationWorkspace,
);
router.patch(
  '/:sessionId/consultations/:consultationId/workspace',
  studySessionController.saveConsultationWorkspace,
);
router.post('/:sessionId/members/:memberUserId/chat', studySessionController.openMemberChat);
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
router.patch('/:sessionId/time-expiry/extend', studySessionController.extendExpiredSession);
router.patch('/:sessionId/time-expiry/stay', studySessionController.stayInExtendedSession);
router.patch('/:sessionId/time-expiry/leave', studySessionController.leaveSessionMember);
router.patch('/:sessionId/exit', studySessionController.exitSession);

module.exports = router;
