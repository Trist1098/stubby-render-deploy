const calendarEvents = [
  {
    id: 1,
    title: 'Project Review',
    date: '2026-05-14',
    start: '10:00',
    end: '11:00',
    description: 'Discuss the current sprint deliverables and next steps.',
  },
  {
    id: 2,
    title: 'Study Group',
    date: '2026-05-17',
    start: '16:00',
    end: '18:00',
    description: 'Collaborate on the database schema and API design.',
  },
  {
    id: 3,
    title: 'Code Sprint',
    date: '2026-05-21',
    start: '09:00',
    end: '12:00',
    description: 'Implement the remaining features and fix open bugs.',
  },
  {
    id: 4,
    title: 'Peer Feedback',
    date: '2026-05-27',
    start: '14:00',
    end: '15:00',
    description: 'Review the calendar UI and improve accessibility.',
  },
];

const getCalendarEvents = () => Promise.resolve(calendarEvents);

module.exports = {
  getCalendarEvents,
};
