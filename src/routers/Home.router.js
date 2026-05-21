const express = require('express');
const router = express.Router();
const jwtMiddleware = require('../middlewares/jwt.middleware');
const {
  getCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  getCalendarEventById,
  getProgressSummary,
  getTodayProgress,
  getGoalProgress,
  getActivity,
  getReminders,
  createReminder,
} = require('../controllers/Home.controller');

// ##############################################################
// FEATURE: Home & Dashboard
// ##############################################################

router.get('/calendar', jwtMiddleware.verifyToken, getCalendarEvents);
router.get('/calendar/:id', jwtMiddleware.verifyToken, getCalendarEventById);
router.post('/calendar', jwtMiddleware.verifyToken, createCalendarEvent);
router.put('/calendar/:id', jwtMiddleware.verifyToken, updateCalendarEvent);
router.delete('/calendar/:id', jwtMiddleware.verifyToken, deleteCalendarEvent);

// Progress tracking endpoints
router.get('/progress/summary', jwtMiddleware.verifyToken, getProgressSummary);
router.get('/progress/today', jwtMiddleware.verifyToken, getTodayProgress);
router.get('/progress/goals', jwtMiddleware.verifyToken, getGoalProgress);
router.get('/activity', jwtMiddleware.verifyToken, getActivity);
router.get('/reminders', jwtMiddleware.verifyToken, getReminders);
router.post('/reminders', jwtMiddleware.verifyToken, createReminder);

module.exports = router;
