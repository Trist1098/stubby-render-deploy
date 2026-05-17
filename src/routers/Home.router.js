const express = require('express');
const router = express.Router();
const jwtMiddleware = require('../middlewares/jwt.middleware');
const {
  getCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} = require('../controllers/Home.controller');

// ##############################################################
// FEATURE: Home & Dashboard
// ##############################################################

router.get('/calendar', jwtMiddleware.verifyToken, getCalendarEvents);
router.post('/calendar', jwtMiddleware.verifyToken, createCalendarEvent);
router.put('/calendar/:id', jwtMiddleware.verifyToken, updateCalendarEvent);
router.delete('/calendar/:id', jwtMiddleware.verifyToken, deleteCalendarEvent);

module.exports = router;
