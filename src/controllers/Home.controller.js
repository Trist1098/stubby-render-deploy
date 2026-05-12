const model = require('../models/Home.model');

const getCalendarEvents = (req, res, next) => {
  model.getCalendarEvents()
    .then((events) => res.status(200).json({ events }))
    .catch(next);
};

module.exports = {
  getCalendarEvents,
};
