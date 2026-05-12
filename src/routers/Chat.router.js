const express = require('express');
const router = express.Router();
const jwtMiddleware = require('../middlewares/jwt.middleware');
const model = require('../models/Chat.model');

// ##############################################################
// FEATURE: Chat & Messaging
// ##############################################################

module.exports = router;
