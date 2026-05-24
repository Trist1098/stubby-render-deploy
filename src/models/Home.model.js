const pool = require('./db');

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

module.exports.getCalendarEvents = async function getCalendarEvents(userId) {
  const SQLSTATEMENT = `
    SELECT c.event_id, c.creator_id, c.module_id, c.name, c.topic, c.location,
           TO_CHAR(c.event_date, 'YYYY-MM-DD') AS date,
           c.booking_time, c.type, c.status, c.priority, c.color, c.goal_completed,
           c.remind_at, c.notes,
           COALESCE(json_agg(json_build_object('user_id', ep.user_id, 'status', ep.status, 'joined_at', ep.joined_at)) FILTER (WHERE ep.user_id IS NOT NULL), '[]') as participants
    FROM CalendarEvent c
    LEFT JOIN EventParticipant ep ON c.event_id = ep.event_id
    WHERE c.creator_id = $1 OR c.event_id IN (
      SELECT event_id FROM EventParticipant WHERE user_id = $1
    )
    GROUP BY c.event_id
    ORDER BY c.event_date ASC
  `;
  const { rows } = await pool.query(SQLSTATEMENT, [userId]);
  return rows;
};

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

const getActivity = (userId, limit = 20) => Promise.resolve(
  activityLog.slice(0, limit).map((item) => ({ ...item }))
);

const getReminders = async (userId, limit = 20) => {
  const SQLSTATEMENT = `
    SELECT event_id, name, remind_at
    FROM CalendarEvent
    WHERE remind_at IS NOT NULL
    ORDER BY remind_at ASC
    LIMIT $1
  `;
  const { rows } = await pool.query(SQLSTATEMENT, [limit]);
  return rows.map((event) => ({
    id: `event-${event.event_id}`,
    type: 'event',
    eventId: event.event_id,
    eventTitle: event.name,
    message: `Reminder for ${event.name}`,
    remindAt: event.remind_at,
    createdAt: event.remind_at,
  }));
};

const createReminder = async (payload) => {
  if (!payload.eventId || !payload.remindAt) {
    throw new Error('eventId and remindAt are required');
  }
  const eventId = Number(payload.eventId);
  const { rows } = await pool.query(
    `UPDATE CalendarEvent
     SET remind_at = $1
     WHERE event_id = $2
     RETURNING event_id, name, remind_at`,
    [payload.remindAt, eventId]
  );
  const event = rows[0];
  if (!event) throw new Error('Event not found');
  return {
    id: `event-${event.event_id}`,
    eventId: event.event_id,
    eventTitle: event.name,
    message: payload.message || `Reminder for ${event.name}`,
    remindAt: event.remind_at,
    createdAt: new Date().toISOString(),
  };
};

const getCalendarEventById = async (id) => {
  const SQLSTATEMENT = `
    SELECT event_id, creator_id, request_id, module_id, name, topic, location,
           is_online, meeting_url, TO_CHAR(event_date, 'YYYY-MM-DD') AS date,
           booking_time, type, status, priority, color, goal_completed, remind_at, notes
    FROM CalendarEvent
    WHERE event_id = $1
  `;
  const { rows } = await pool.query(SQLSTATEMENT, [id]);
  return rows[0] || null;
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

module.exports.createCalendarEvent = async function createCalendarEvent(data) {
  const SQLSTATEMENT = `
    INSERT INTO CalendarEvent (creator_id, request_id, module_id, name, topic, location, is_online, meeting_url, event_date, booking_time, type, status, priority, color, goal_completed, remind_at, notes)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    RETURNING event_id, creator_id, request_id, module_id, name, topic, location, is_online, meeting_url, TO_CHAR(event_date, 'YYYY-MM-DD') AS date, booking_time, type, status, priority, color, goal_completed, remind_at, notes
  `;
  const remindAt = data.remind_at || parseReminderOffset(data.reminder_offset, {
    date: data.event_date,
    start: (data.booking_time || '').split(' - ')[0],
  });
  const VALUES = [
    data.creator_id,
    data.request_id || null,
    data.module_id || null,
    data.name,
    data.topic || '',
    data.location || '',
    data.is_online || false,
    data.meeting_url || null,
    data.event_date,
    data.booking_time || '',
    data.type || 'Study Session',
    data.status || 'Confirmed',
    data.priority || 'medium',
    data.color || 'primary',
    data.goal_completed || false,
    remindAt,
    data.notes || ''
  ];
  const { rows } = await pool.query(SQLSTATEMENT, VALUES);
  const newEvent = rows[0];

  if (newEvent) {
    try {
      const PARTICIPANT_SQL = `INSERT INTO EventParticipant (event_id, user_id, status) VALUES ($1, $2, $3)`;
      if (data.partner_id) {
        await pool.query(PARTICIPANT_SQL, [newEvent.event_id, data.partner_id, 'Accepted']);
      }
      if (data.co_participants && Array.isArray(data.co_participants)) {
        for (const pId of data.co_participants) {
          await pool.query(PARTICIPANT_SQL, [newEvent.event_id, pId, 'Pending']);
        }
      }
    } catch (partErr) {
      console.error("Error inserting into EventParticipant:", partErr);
    }
  }

  return newEvent;
};

const updateCalendarEvent = async (id, payload) => {
  const current = await getCalendarEventById(id);
  if (!current) return null;

  const data = {
    name: payload.name !== undefined ? payload.name : current.name,
    topic: payload.topic !== undefined ? payload.topic : current.topic,
    location: payload.location !== undefined ? payload.location : current.location,
    event_date: payload.event_date !== undefined ? payload.event_date : current.date,
    booking_time: payload.booking_time !== undefined ? payload.booking_time : current.booking_time,
    type: payload.type !== undefined ? payload.type : current.type,
    status: payload.status !== undefined ? payload.status : current.status,
    priority: payload.priority !== undefined ? payload.priority : current.priority,
    color: payload.color !== undefined ? payload.color : current.color,
    goal_completed: payload.goal_completed !== undefined ? Boolean(payload.goal_completed) : Boolean(current.goal_completed),
    remind_at: payload.remind_at !== undefined
      ? payload.remind_at
      : (payload.reminder_offset ? parseReminderOffset(payload.reminder_offset, {
        date: payload.event_date || current.date,
        start: (payload.booking_time || current.booking_time || '').split(' - ')[0],
      }) : current.remind_at),
    notes: payload.notes !== undefined ? payload.notes : current.notes,
  };

  const SQLSTATEMENT = `
    UPDATE CalendarEvent
    SET name = $1,
        topic = $2,
        location = $3,
        event_date = $4,
        booking_time = $5,
        type = $6,
        status = $7,
        priority = $8,
        color = $9,
        goal_completed = $10,
        remind_at = $11,
        notes = $12
    WHERE event_id = $13
    RETURNING event_id, creator_id, request_id, module_id, name, topic, location,
              is_online, meeting_url, TO_CHAR(event_date, 'YYYY-MM-DD') AS date,
              booking_time, type, status, priority, color, goal_completed, remind_at, notes
  `;
  const values = [
    data.name,
    data.topic,
    data.location,
    data.event_date,
    data.booking_time,
    data.type,
    data.status,
    data.priority,
    data.color,
    data.goal_completed,
    data.remind_at,
    data.notes,
    id,
  ];
  const { rows } = await pool.query(SQLSTATEMENT, values);
  return rows[0] || null;
};

const deleteCalendarEvent = async (id) => {
  const SQLSTATEMENT = `
    DELETE FROM CalendarEvent
    WHERE event_id = $1
    RETURNING event_id, creator_id, request_id, module_id, name, topic, location,
              is_online, meeting_url, TO_CHAR(event_date, 'YYYY-MM-DD') AS date,
              booking_time, type, status, priority, color, goal_completed, remind_at, notes
  `;
  const { rows } = await pool.query(SQLSTATEMENT, [id]);
  return rows[0] || null;
};

const getProgressSummary = async () => {
  const { rows } = await pool.query(`
    SELECT COUNT(*)::INT AS total,
           COUNT(*) FILTER (WHERE goal_completed = TRUE)::INT AS completed
    FROM CalendarEvent
  `);
  const total = rows[0]?.total || 0;
  const completed = rows[0]?.completed || 0;
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
  return {
    total,
    completed,
    percentage,
    remaining: total - completed,
  };
};

const getTodayProgress = async () => {
  const { rows } = await pool.query(`
    SELECT COUNT(*)::INT AS total,
           COUNT(*) FILTER (WHERE goal_completed = TRUE)::INT AS completed
    FROM CalendarEvent
    WHERE event_date = CURRENT_DATE
  `);
  const total = rows[0]?.total || 0;
  const completedToday = rows[0]?.completed || 0;
  const percentageToday = total === 0 ? 0 : Math.round((completedToday / total) * 100);
  return {
    total,
    completed: completedToday,
    percentage: percentageToday,
    remaining: total - completedToday,
  };
};

const getGoalProgress = async () => {
  const { rows } = await pool.query(`
    SELECT COUNT(*)::INT AS total,
           COUNT(*) FILTER (WHERE goal_completed = TRUE)::INT AS completed
    FROM CalendarEvent
    WHERE COALESCE(NULLIF(TRIM(topic), ''), NULL) IS NOT NULL
  `);
  const total = rows[0]?.total || 0;
  const completedGoals = rows[0]?.completed || 0;
  const percentageGoals = total === 0 ? 0 : Math.round((completedGoals / total) * 100);
  return {
    total,
    completed: completedGoals,
    percentage: percentageGoals,
    remaining: total - completedGoals,
  };
};

module.exports = {
  getCalendarEvents: module.exports.getCalendarEvents,
  getCalendarEventById,
  createCalendarEvent: module.exports.createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  getProgressSummary,
  getTodayProgress,
  getGoalProgress,
  getActivity,
  getReminders,
  createReminder,
};
