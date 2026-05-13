const friendModel = require('../models/Friend.model');

module.exports.getAllFriends = async function (req, res, next) {
  const userId = res.locals.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const friends = await friendModel.getFriendsForUser(userId);
    res.status(200).json(friends);
  } catch (error) {
    console.error('Error getAllFriends:', error);
    next(error);
  }
};

module.exports.addNewFriend = async function (req, res, next) {
  const userId = res.locals.userId;
  const friendId = Number(req.body.friendId ?? req.body.friend_id);

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!friendId || Number.isNaN(friendId)) {
    return res.status(400).json({ message: 'friendId is required' });
  }

  if (friendId === userId) {
    return res.status(400).json({ message: 'Cannot add yourself as a friend' });
  }

  try {
    const friendship = await friendModel.createFriendship({ userId, friendId });

    if (!friendship) {
      return res.status(409).json({ message: 'Friendship already exists' });
    }

    res.status(201).json(friendship);
  } catch (error) {
    console.error('Error addNewFriend:', error);
    next(error);
  }
};

module.exports.removeFriend = async function (req, res, next) {
  const userId = res.locals.userId;
  const friendId = Number(req.params.friendId);

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!friendId || Number.isNaN(friendId)) {
    return res.status(400).json({ message: 'friendId is required' });
  }

  try {
    const deletedCount = await friendModel.deleteFriendship({ userId, friendId });

    if (deletedCount === 0) {
      return res.status(404).json({ message: 'Friend not found' });
    }

    res.sendStatus(204);
  } catch (error) {
    console.error('Error removeFriend:', error);
    next(error);
  }
};
