const friendRequestModel = require('../models/FriendRequest.model');
const friendshipModel = require('../models/Friend.model');
const { selectPublicUserById } = require('../models/User.model');

module.exports.createNewFriendRequest = async function (req, res, next) {
  const senderId = Number(req.params.senderId);
  const receiverId = Number(req.params.receiverId);
  const authUserId = res.locals.userId;

  if (!authUserId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (authUserId !== senderId) {
    return res.status(403).json({ error: 'Sender ID does not match authenticated user' });
  }

  if (!senderId || !receiverId || Number.isNaN(senderId) || Number.isNaN(receiverId)) {
    return res
      .status(400)
      .json({ message: 'senderId and receiverId are required and must be valid integers' });
  }

  if (senderId === receiverId) {
    return res.status(400).json({ message: 'senderId and receiverId must be different' });
  }

  try {
    const receiver = await selectPublicUserById({ userId: receiverId });
    if (!receiver) {
      return res.status(404).json({ message: 'Receiver not found' });
    }

    if (receiver.friend_request_private) {
      return res
        .status(403)
        .json({ message: 'This user is not accepting friend requests right now' });
    }

    const existingFriends = await friendshipModel.getFriendsForUser(senderId);
    if (existingFriends.some((friend) => friend.friend_id === receiverId)) {
      return res.status(409).json({ message: 'Users are already friends' });
    }

    const existingRequest = await friendRequestModel.getFriendRequestBetweenUsers({
      senderId,
      receiverId,
    });
    if (existingRequest) {
      return res
        .status(409)
        .json({ message: 'A friend request is already pending between these users' });
    }

    const request = await friendRequestModel.createFriendRequest({ senderId, receiverId });
    if (!request) {
      return res.status(409).json({ message: 'Friend request already exists' });
    }

    res.status(201).json({ message: 'Friend request created', request });
  } catch (error) {
    console.error('Error createNewFriendRequest:', error);
    next(error);
  }
};

module.exports.deleteFriendRequest = async function (req, res, next) {
  const authUserId = res.locals.userId;
  const requestId = Number(req.params.request_id);

  if (!authUserId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!requestId || Number.isNaN(requestId)) {
    return res.status(400).json({ message: 'request_id is required and must be a valid integer' });
  }

  try {
    const request = await friendRequestModel.getFriendRequestById(requestId);
    if (!request) {
      return res.status(404).json({ message: 'Friend request not found' });
    }

    if (request.sender_id !== authUserId) {
      return res
        .status(403)
        .json({ message: 'Only the request sender can cancel this friend request' });
    }

    await friendRequestModel.deleteFriendRequestById(requestId);
    res.sendStatus(204);
  } catch (error) {
    console.error('Error deleteFriendRequest:', error);
    next(error);
  }
};

module.exports.acceptFriendRequest = async function (req, res, next) {
  const authUserId = res.locals.userId;
  const receiverId = Number(req.params.receiver_id);
  const requestId = Number(req.params.request_id);

  if (!authUserId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!receiverId || !requestId || Number.isNaN(receiverId) || Number.isNaN(requestId)) {
    return res
      .status(400)
      .json({ message: 'receiver_id and request_id are required and must be valid integers' });
  }

  if (authUserId !== receiverId) {
    return res.status(403).json({ message: 'Authenticated user must match receiver_id' });
  }

  try {
    const request = await friendRequestModel.getFriendRequestById(requestId);
    if (!request) {
      return res.status(404).json({ message: 'Friend request not found' });
    }

    if (request.receiver_id !== receiverId) {
      return res
        .status(403)
        .json({ message: 'This friend request does not belong to the authenticated receiver' });
    }

    await friendshipModel.createFriendship({
      userId: request.sender_id,
      friendId: request.receiver_id,
    });
    await friendshipModel.createFriendship({
      userId: request.receiver_id,
      friendId: request.sender_id,
    });
    await friendRequestModel.deleteFriendRequestById(requestId);

    res.status(200).json({ message: 'Friend request accepted' });
  } catch (error) {
    console.error('Error acceptFriendRequest:', error);
    next(error);
  }
};

module.exports.rejectFriendRequest = async function (req, res, next) {
  const authUserId = res.locals.userId;
  const receiverId = Number(req.params.receiver_id);
  const requestId = Number(req.params.request_id);

  if (!authUserId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!receiverId || !requestId || Number.isNaN(receiverId) || Number.isNaN(requestId)) {
    return res
      .status(400)
      .json({ message: 'receiver_id and request_id are required and must be valid integers' });
  }

  if (authUserId !== receiverId) {
    return res.status(403).json({ message: 'Authenticated user must match receiver_id' });
  }

  try {
    const request = await friendRequestModel.getFriendRequestById(requestId);
    if (!request) {
      return res.status(404).json({ message: 'Friend request not found' });
    }

    if (request.receiver_id !== receiverId) {
      return res
        .status(403)
        .json({ message: 'This friend request does not belong to the authenticated receiver' });
    }

    await friendRequestModel.deleteFriendRequestById(requestId);
    res.sendStatus(204);
  } catch (error) {
    console.error('Error rejectFriendRequest:', error);
    next(error);
  }
};

module.exports.getIncomingFriendRequests = async function (req, res, next) {
  const authUserId = res.locals.userId;
  const userId = Number(req.params.user_id);

  if (!authUserId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!userId || Number.isNaN(userId)) {
    return res.status(400).json({ message: 'user_id is required and must be a valid integer' });
  }

  if (authUserId !== userId) {
    return res.status(403).json({ message: 'Authenticated user must match user_id' });
  }

  try {
    const requests = await friendRequestModel.getIncomingRequests(userId);
    res.status(200).json(requests);
  } catch (error) {
    console.error('Error getIncomingFriendRequests:', error);
    next(error);
  }
};

module.exports.getOutgoingFriendRequests = async function (req, res, next) {
  const authUserId = res.locals.userId;
  const userId = Number(req.params.user_id);

  if (!authUserId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!userId || Number.isNaN(userId)) {
    return res.status(400).json({ message: 'user_id is required and must be a valid integer' });
  }

  if (authUserId !== userId) {
    return res.status(403).json({ message: 'Authenticated user must match user_id' });
  }

  try {
    const requests = await friendRequestModel.getOutgoingRequests(userId);
    res.status(200).json(requests);
  } catch (error) {
    console.error('Error getOutgoingFriendRequests:', error);
    next(error);
  }
};
