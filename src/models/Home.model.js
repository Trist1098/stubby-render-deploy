const calendarEvents = [
  {
    id: 1,
    title: 'Project Review',
    date: '2026-05-14',
    start: '10:00',
    end: '11:00',
    description: 'Discuss the current sprint deliverables and next steps.',
    color: 'primary',
    priority: 'high',
    goal: 'Finalize scope and assign tasks',
    goalCompleted: false,
  },
  {
    id: 2,
    title: 'Study Group',
    date: '2026-05-17',
    start: '16:00',
    end: '18:00',
    description: 'Collaborate on the database schema and API design.',
    color: 'success',
    priority: 'medium',
    goal: 'Review entity relationships',
    goalCompleted: false,
  },
  {
    id: 3,
    title: 'Code Sprint',
    date: '2026-05-21',
    start: '09:00',
    end: '12:00',
    description: 'Implement the remaining features and fix open bugs.',
    color: 'warning',
    priority: 'high',
    goal: 'Finish calendar task flow',
    goalCompleted: false,
  },
  {
    id: 4,
    title: 'Peer Feedback',
    date: '2026-05-27',
    start: '14:00',
    end: '15:00',
    description: 'Review the calendar UI and improve accessibility.',
    color: 'info',
    priority: 'low',
    goal: 'Collect usability notes',
    goalCompleted: false,
  },
];

const allowedPriorities = ['low', 'medium', 'high'];
const allowedColors = ['primary', 'success', 'warning', 'danger', 'info', 'secondary'];

const activityLog = [];
const reminders = [];

const cloneEvent = (event) => ({ ...event });

const cloneReminder = (reminder) => ({ ...reminder });

const recordActivity = (action, event) => {
  const entry = {
    id: activityLog.length + 1,
    type: action,
    message: `${action.charAt(0).toUpperCase() + action.slice(1)} event: ${event.title}`,
    details: event.description || '',
    eventId: event.id,
    createdAt: new Date().toISOString(),
  };
  activityLog.unshift(entry);
  if (activityLog.length > 50) {
    activityLog.pop();
  }
  return entry;
};

// Return only events that are not marked as goalCompleted so completed goals
// are removed from the main calendar view.
const parseReminderOffset = (offset, event) => {
  if (!offset || !event?.date || !event?.start) return null;
  const mapping = {
    '10m': 10,
    '30m': 30,
    '1h': 60,
    '1d': 1440,
  };
  const minutes = mapping[offset];
  if (!minutes) return null;
  const eventDateTime = new Date(`${event.date}T${event.start}:00`);
  eventDateTime.setMinutes(eventDateTime.getMinutes() - minutes);
  return eventDateTime.toISOString();
};

const getCalendarEvents = () => Promise.resolve(
  calendarEvents.filter((event) => !event.goalCompleted).map(cloneEvent)
);

const getActivity = (userId, limit = 20) => Promise.resolve(
  activityLog.slice(0, limit).map((item) => ({ ...item }))
);

const getReminders = (userId, limit = 20) => {
  const eventReminders = calendarEvents
    .filter((event) => event.remindAt)
    .map((event) => ({
      id: `event-${event.id}`,
      type: 'event',
      eventId: event.id,
      eventTitle: event.title,
      message: `Reminder for ${event.title}`,
      remindAt: event.remindAt,
      createdAt: event.remindAt,
    }));
  const allReminders = [...eventReminders, ...reminders.map(cloneReminder)];
  allReminders.sort((a, b) => new Date(a.remindAt) - new Date(b.remindAt));
  return Promise.resolve(allReminders.slice(0, limit));
};

const createReminder = (payload) => {
  if (!payload.eventId || !payload.remindAt) {
    return Promise.reject(new Error('eventId and remindAt are required'));
  }
  const eventId = Number(payload.eventId);
  const event = calendarEvents.find((item) => item.id === eventId);
  if (!event) {
    return Promise.reject(new Error('Event not found'));
  }
  const reminder = {
    id: reminders.length + 1,
    eventId,
    eventTitle: event.title,
    message: payload.message || `Reminder for ${event.title}`,
    remindAt: payload.remindAt,
    createdAt: new Date().toISOString(),
  };
  reminders.unshift(reminder);
  if (reminders.length > 50) {
    reminders.pop();
  }
  return Promise.resolve(cloneReminder(reminder));
};

const getCalendarEventById = (id) => {
  const event = calendarEvents.find((item) => item.id === id);
  return Promise.resolve(event ? cloneEvent(event) : null);
};

const getNextId = () => Math.max(0, ...calendarEvents.map((item) => item.id)) + 1;

const validateEventPayload = (payload) => {
  const errors = [];
  if (!payload.title || typeof payload.title !== 'string') {
    errors.push('title is required');
  }
  if (!payload.date || typeof payload.date !== 'string') {
    errors.push('date is required');
  }
  if (!payload.start || typeof payload.start !== 'string') {
    errors.push('start is required');
  }
  if (!payload.end || typeof payload.end !== 'string') {
    errors.push('end is required');
  }
  if (payload.priority && !allowedPriorities.includes(payload.priority)) {
    errors.push(`priority must be one of: ${allowedPriorities.join(', ')}`);
  }
  if (payload.color && !allowedColors.includes(payload.color)) {
    errors.push(`color must be one of: ${allowedColors.join(', ')}`);
  }
  return errors;
};

const createCalendarEvent = (payload) => {
  const errors = validateEventPayload(payload);
  if (errors.length) {
    return Promise.reject(new Error(errors.join('; ')));
  }

  const event = {
    id: getNextId(),
    title: payload.title,
    date: payload.date,
    start: payload.start,
    end: payload.end,
    description: payload.description || '',
    color: payload.color || 'primary',
    priority: payload.priority || 'medium',
    goal: payload.goal || '',
    goalCompleted: Boolean(payload.goalCompleted),
    remindAt: payload.remindAt || parseReminderOffset(payload.reminderOffset, payload) || null,
  };

  calendarEvents.push(event);
  recordActivity('created', event);
  return Promise.resolve(cloneEvent(event));
};

const updateCalendarEvent = (id, payload) => {
  const event = calendarEvents.find((item) => item.id === id);
  if (!event) {
    return Promise.resolve(null);
  }

  const mergedPayload = {
    title: payload.title !== undefined ? payload.title : event.title,
    date: payload.date !== undefined ? payload.date : event.date,
    start: payload.start !== undefined ? payload.start : event.start,
    end: payload.end !== undefined ? payload.end : event.end,
    priority: payload.priority !== undefined ? payload.priority : event.priority,
    color: payload.color !== undefined ? payload.color : event.color,
  };

  const errors = validateEventPayload(mergedPayload);
  if (errors.length) {
    return Promise.reject(new Error(errors.join('; ')));
  }

  event.title = mergedPayload.title;
  event.date = mergedPayload.date;
  event.start = mergedPayload.start;
  event.end = mergedPayload.end;
  event.priority = mergedPayload.priority;
  event.color = mergedPayload.color;
  event.description = payload.description !== undefined ? payload.description : event.description;
  event.goal = payload.goal !== undefined ? payload.goal : event.goal;
  event.goalCompleted = payload.goalCompleted !== undefined ? Boolean(payload.goalCompleted) : event.goalCompleted;
  if (payload.remindAt !== undefined) {
    event.remindAt = payload.remindAt || null;
  } else if (payload.reminderOffset) {
    event.remindAt = parseReminderOffset(payload.reminderOffset, { date: event.date, start: event.start }) || event.remindAt;
  }

  recordActivity('updated', event);
  return Promise.resolve(cloneEvent(event));
};

const deleteCalendarEvent = (id) => {
  const index = calendarEvents.findIndex((item) => item.id === id);
  if (index === -1) {
    return Promise.resolve(null);
  }
  const [deleted] = calendarEvents.splice(index, 1);
  recordActivity('deleted', deleted);
  return Promise.resolve(cloneEvent(deleted));
};

const getProgressSummary = () => {
  const total = calendarEvents.length;
  const completed = calendarEvents.filter((event) => event.goalCompleted).length;
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
  return Promise.resolve({
    total,
    completed,
    percentage,
    remaining: total - completed,
  });
};

const getTodayProgress = () => {
  const today = new Date().toISOString().split('T')[0];
  const todayEvents = calendarEvents.filter((event) => event.date === today);
  const completedToday = todayEvents.filter((event) => event.goalCompleted).length;
  const percentageToday = todayEvents.length === 0 ? 0 : Math.round((completedToday / todayEvents.length) * 100);
  return Promise.resolve({
    total: todayEvents.length,
    completed: completedToday,
    percentage: percentageToday,
    remaining: todayEvents.length - completedToday,
  });
};

const getGoalProgress = () => {
  const goalEvents = calendarEvents.filter((event) => event.goal && event.goal.trim() !== '');
  const completedGoals = goalEvents.filter((event) => event.goalCompleted).length;
  const percentageGoals = goalEvents.length === 0 ? 0 : Math.round((completedGoals / goalEvents.length) * 100);
  return Promise.resolve({
    total: goalEvents.length,
    completed: completedGoals,
    percentage: percentageGoals,
    remaining: goalEvents.length - completedGoals,
  });
};

module.exports = {
  getCalendarEvents,
  getCalendarEventById,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  getProgressSummary,
  getTodayProgress,
  getGoalProgress,
  getActivity,
  getReminders,
  createReminder,
};
