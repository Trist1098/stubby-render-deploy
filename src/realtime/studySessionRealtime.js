const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const model = require('../models/StudySession.model');

const secretKey = process.env.JWT_SECRET_KEY || 'stubby_default_secret';
const tokenAlgorithm = process.env.JWT_ALGORITHM || 'HS256';

let studySessionWire = null;

const toUsableId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const studyRoomName = (sessionId) => `session:${sessionId}`;

function initStudySessionRealtime(server) {
  studySessionWire = new Server(server);

  studySessionWire.use((socket, next) => {
    const rawToken = socket.handshake.auth?.token || '';
    const token = rawToken.startsWith('Bearer ') ? rawToken.slice(7) : rawToken;

    if (!token) return next(new Error('No token provided'));

    try {
      const decoded = jwt.verify(token, secretKey, { algorithms: [tokenAlgorithm] });
      socket.data.userId = toUsableId(decoded.userId);
      if (!socket.data.userId) return next(new Error('Invalid token'));
      return next();
    } catch {
      return next(new Error('Invalid token'));
    }
  });

  studySessionWire.on('connection', (socket) => {
    socket.on('study-session:join', async ({ sessionId } = {}) => {
      const joinedSessionId = toUsableId(sessionId);
      if (!joinedSessionId) {
        socket.emit('study-session:error', { message: 'Valid session id is required' });
        return;
      }

      try {
        const hasAccess = await model.ensureSessionAccessForUser(
          joinedSessionId,
          socket.data.userId,
        );
        if (!hasAccess) {
          socket.emit('study-session:error', { message: 'You are not invited to this session' });
          return;
        }

        socket.join(studyRoomName(joinedSessionId));
        socket.emit('study-session:joined', {
          sessionId: joinedSessionId,
          userId: socket.data.userId,
        });
      } catch {
        socket.emit('study-session:error', { message: 'Could not join the live session' });
      }
    });
  });

  return studySessionWire;
}

function emitSessionEvent(sessionId, eventName, eventBody = {}) {
  if (!studySessionWire || !sessionId || !eventName) return;
  studySessionWire.to(studyRoomName(sessionId)).emit(eventName, {
    sessionId,
    ...eventBody,
  });
}

module.exports = {
  emitSessionEvent,
  initStudySessionRealtime,
};
