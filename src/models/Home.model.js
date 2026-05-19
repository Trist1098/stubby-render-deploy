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

const cloneEvent = (event) => ({ ...event });

// Return only events that are not marked as goalCompleted so completed goals
// are removed from the main calendar view.
const getCalendarEvents = () => Promise.resolve(
  calendarEvents.filter((event) => !event.goalCompleted).map(cloneEvent)
);

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
  };

  calendarEvents.push(event);
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

  return Promise.resolve(cloneEvent(event));
};

const deleteCalendarEvent = (id) => {
  const index = calendarEvents.findIndex((item) => item.id === id);
  if (index === -1) {
    return Promise.resolve(null);
  }
  const [deleted] = calendarEvents.splice(index, 1);
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
};
