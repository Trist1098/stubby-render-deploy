const express = require('express');
const router = express.Router();
const jwtMiddleware = require('../middlewares/jwt.middleware');
const { getCalendarEvents } = require('../controllers/Home.controller');

// ##############################################################
// FEATURE: Home & Dashboard
// ##############################################################

router.get('/calendar', jwtMiddleware.verifyToken, getCalendarEvents);

module.exports = router;
