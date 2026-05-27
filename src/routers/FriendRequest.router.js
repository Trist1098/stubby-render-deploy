const express = require('express');
const router = express.Router();
const jwtMiddleware = require('../middlewares/jwt.middleware');
const friendController = require('../controllers/FriendRequest.controller');

// ##############################################################
// FEATURE: Friend Request Management
// ##############################################################

// Create a new friend request
router.post('/create/:senderId/:receiverId', jwtMiddleware.verifyToken, friendController.createNewFriendRequest);

// Delete a friend request (cancel an outgoing request)
router.delete('/:request_id', jwtMiddleware.verifyToken, friendController.deleteFriendRequest);

// Accept a friend request
router.post('/accept/:receiver_id/:request_id', jwtMiddleware.verifyToken, friendController.acceptFriendRequest);

// Reject a friend request
router.delete('/reject/:receiver_id/:request_id', jwtMiddleware.verifyToken, friendController.rejectFriendRequest);

// Get all incoming friend requests for the authenticated user
router.get('/incoming/:user_id', jwtMiddleware.verifyToken, friendController.getIncomingFriendRequests);

// Get the pending incoming count for navbar and profile notification indicators
router.get('/incoming-count', jwtMiddleware.verifyToken, friendController.getIncomingFriendRequestCount);

// Get all outgoing friend requests sent by the authenticated user
router.get('/outgoing/:user_id', jwtMiddleware.verifyToken, friendController.getOutgoingFriendRequests);

module.exports = router;
