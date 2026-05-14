const express = require('express');
const router = express.Router();
const jwtMiddleware = require('../middlewares/jwt.middleware');
const friendController = require('../controllers/Friend.controller');

// ##############################################################
// FEATURE: Friend Management
// ##############################################################

router.get('/', jwtMiddleware.verifyToken, friendController.getAllFriends);
router.delete('/:friendId', jwtMiddleware.verifyToken, friendController.removeFriend);

module.exports = router;
