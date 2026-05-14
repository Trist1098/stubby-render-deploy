const express = require('express');
const router = express.Router();
const jwtMiddleware = require('../middlewares/jwt.middleware');
const badgeController = require('../controllers/Badge.controller');

// ##############################################################
// FEATURE: Badge CRUD
// ##############################################################

router.get('/', jwtMiddleware.verifyToken, badgeController.getAllBadges);

module.exports = router;