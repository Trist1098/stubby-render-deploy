const express = require('express');
const router = express.Router();
const jwtMiddleware = require('../middlewares/jwt.middleware');
const userBadgeController = require('../controllers/UserBadge.controller');

// ##############################################################
// FEATURE: User Badge CRUD
// ##############################################################

router.get('/', jwtMiddleware.verifyToken, userBadgeController.getUserOwnedBadges);

module.exports = router;