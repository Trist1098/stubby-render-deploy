const badgeModel = require('../models/Badge.model');

module.exports.getAllBadges = async function (req, res, next) {
  try {
    const badges = await badgeModel.selectAllBadges();
    res.status(200).json(badges);
  } catch (error) {
    console.error('Error getAllBadges:', error);
    next(error);
  }
};

