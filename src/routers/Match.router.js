const express = require('express');
const router = express.Router();
const jwtMiddleware = require('../middlewares/jwt.middleware');
const model = require('../models/Match.model');

// ##############################################################
// FEATURE: Matchmaking
// ##############################################################

module.exports = router;
