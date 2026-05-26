const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/jwt.middleware');
const matchController = require('../controllers/Match.controller');

// ##############################################################
// FEATURE: Matchmaking
// ##############################################################

router.get('/requests', verifyToken, matchController.getAllRequests);
router.get('/requests/sent', verifyToken, matchController.getSentRequests);
router.get('/requests/received', verifyToken, matchController.getReceivedRequests);
router.get('/active', verifyToken, matchController.getActiveMatches);
router.get('/saved', verifyToken, matchController.getSavedStudents);
router.post('/saved/:userId', verifyToken, matchController.saveStudent);
router.delete('/saved/:userId', verifyToken, matchController.unsaveStudent);
router.post('/hidden/:userId', verifyToken, matchController.hideStudent);
router.delete('/hidden/:userId', verifyToken, matchController.unhideStudent);
router.post('/blocked/:userId', verifyToken, matchController.blockStudent);
router.delete('/blocked/:userId', verifyToken, matchController.unblockStudent);
router.post('/reports/:userId', verifyToken, matchController.reportStudent);
router.get('/profile/:userId', verifyToken, matchController.getProfileMatches);
router.post('/request', verifyToken, matchController.sendRequest);
router.get('/request/:id', verifyToken, matchController.getRequestById);
router.put('/request/:id/status', verifyToken, matchController.updateRequestStatus);
router.get('/auto', verifyToken, matchController.autoMatch);
router.get('/shared/:targetId', verifyToken, matchController.getSharedModules);

module.exports = router;
