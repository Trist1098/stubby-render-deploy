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

module.exports = {
  getCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  getCalendarEventById,
};
