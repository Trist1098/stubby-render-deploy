const model = require('../models/Home.model');

// Helper to convert DB booking_time "3:00 PM" -> "15:00"
const convertTo24h = (timeStr) => {
  if (!timeStr) return '09:00';
  const trimmed = timeStr.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return trimmed;
  let [, h, m, period] = match;
  h = parseInt(h, 10);
  if (period.toUpperCase() === 'PM' && h !== 12) h += 12;
  if (period.toUpperCase() === 'AM' && h === 12) h = 0;
  return `${h.toString().padStart(2, '0')}:${m}`;
};

const COLOR_FROM_TYPE = {
  'Study Session': 'primary',
  'Exam Prep': 'warning',
  'Consultation': 'info',
  'Match Session': 'success',
};

const rowToEvent = (row) => {
  let start = '09:00';
  let end = '10:00';

  if (row.booking_time) {
    const parts = row.booking_time.split(' - ');
    if (parts.length === 2) {
      start = convertTo24h(parts[0]);
      end = convertTo24h(parts[1]);
    } else {
      start = convertTo24h(row.booking_time);
      const h = parseInt(start.split(':')[0], 10);
      end = `${((h + 1) % 24).toString().padStart(2, '0')}:${start.split(':')[1]}`;
    }
  }

  let dateStr = row.date;
  if (!dateStr && row.event_date) {
    const d = new Date(row.event_date);
    dateStr = d.toISOString().slice(0, 10);
  }

  return {
    id: row.event_id || row.id,
    title: row.name || row.title,
    date: dateStr,
    start,
    end,
    description: row.notes || [row.topic, row.location].filter(Boolean).join(' · ') || row.description || '',
    color: COLOR_FROM_TYPE[row.type] || row.color || 'primary',
    priority: row.priority || 'medium',
    goal: row.topic || row.goal || '',
    goalCompleted: Boolean(row.goalCompleted),
    partner_id: row.partner_id || null,
    module_id: row.module_id || null,
    status: row.status || 'Confirmed',
    notes: row.notes || '',
    participants: row.participants || []
  };
};

module.exports.getCalendarEvents = async (req, res, next) => {
  try {
    const userId = res.locals.userId || 1;
    const rows = await model.getCalendarEvents(userId);
    const events = rows.map(rowToEvent);
    res.status(200).json({ events });
  } catch (error) {
    next(error);
  }
};

module.exports.createCalendarEvent = async (req, res, next) => {
  try {
    const data = {
      creator_id: res.locals.userId || 1,
      partner_id: req.body.partner_id || null,
      co_participants: req.body.co_participants || [],
      module_id: req.body.module_id || null,
      name: req.body.title,
      topic: req.body.topic || req.body.description || '',
      location: req.body.location || req.body.description || '',
      event_date: req.body.date,
      booking_time: `${req.body.start} - ${req.body.end}`,
      type: req.body.color === 'success' ? 'Match Session' : 'Study Session',
      status: 'Confirmed',
      notes: req.body.notes || req.body.description || ''
    };
    const row = await model.createCalendarEvent(data);
    const event = rowToEvent(row);
    res.status(201).json({ event });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
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

const getGoalProgress = (req, res, next) => {
  model.getGoalProgress()
    .then((progress) => res.status(200).json({ progress }))
    .catch(next);
};

module.exports = {
  getCalendarEvents: module.exports.getCalendarEvents,
  createCalendarEvent: module.exports.createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  getCalendarEventById,
  getProgressSummary,
  getTodayProgress,
  getGoalProgress,
};
