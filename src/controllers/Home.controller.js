const model = require('../models/Home.model');

const getCalendarEvents = (req, res, next) => {
  model.getCalendarEvents()
    .then((events) => res.status(200).json({ events }))
    .catch(next);
};

const createCalendarEvent = (req, res, next) => {
  model.createCalendarEvent(req.body)
    .then((event) => res.status(201).json({ event }))
    .catch((error) => res.status(400).json({ error: error.message }));
};

const updateCalendarEvent = (req, res, next) => {
  const id = Number(req.params.id);
  model.updateCalendarEvent(id, req.body)
    .then((event) => {
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }
      res.status(200).json({ event });
    })
    .catch((error) => res.status(400).json({ error: error.message }));
};

const deleteCalendarEvent = (req, res, next) => {
  const id = Number(req.params.id);
  model.deleteCalendarEvent(id)
    .then((event) => {
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }
      res.status(200).json({ event });
    })
    .catch(next);
};

const getCalendarEventById = (req, res, next) => {
  const id = Number(req.params.id);
  model.getCalendarEventById(id)
    .then((event) => {
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }
      res.status(200).json({ event });
    })
    .catch(next);
};

const getProgressSummary = (req, res, next) => {
  model.getProgressSummary()
    .then((progress) => res.status(200).json({ progress }))
    .catch(next);
};

const getTodayProgress = (req, res, next) => {
  model.getTodayProgress()
    .then((progress) => res.status(200).json({ progress }))
    .catch(next);
};

const getActivity = (req, res, next) => {
  const limit = Number(req.query.limit) || 20;
  model.getActivity(req.user?.id, limit)
    .then((activity) => res.status(200).json({ activity }))
    .catch(next);
};

const getGoalProgress = (req, res, next) => {
  model.getGoalProgress()
    .then((progress) => res.status(200).json({ progress }))
    .catch(next);
};

module.exports = {
  getCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  getCalendarEventById,
  getProgressSummary,
  getTodayProgress,
  getGoalProgress,
  getActivity,
};
