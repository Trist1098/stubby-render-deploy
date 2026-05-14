const userBadgeModel = require('../models/UserBadge.model');

module.exports.getUserOwnedBadges = async function (req, res, next) {

  const userId = req.params.userId;

  try {
    const badges = await userBadgeModel.selectUserOwnedBadges(userId);
    res.status(200).json(badges);
  } catch (error) {
    console.error('Error getUserOwnedBadges:', error);
    next(error);
  }
};

