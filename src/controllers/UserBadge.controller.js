const friendModel = require('../models/UserBadge.model');

module.exports.getUserOwnedBadges = async function (req, res, next) {
  try {
    const badges = await userBadgeModel.selectUserOwnedBadges(req.user.id);
    res.status(200).json(badges);
  } catch (error) {
    console.error('Error getUserOwnedBadges:', error);
    next(error);
  }
};

