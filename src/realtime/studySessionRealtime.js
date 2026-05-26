const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const model = require('../models/StudySession.model');

const secretKey = process.env.JWT_SECRET_KEY || 'stubby_default_secret';
const tokenAlgorithm = process.env.JWT_ALGORITHM || 'HS256';

let io = null;

const parseId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const sessionRoom = (sessionId) => `session:${sessionId}`;

function initStudySessionRealtime(server) {
  io = new Server(server);

  io.use((socket, next) => {
    const rawToken = socket.handshake.auth?.token || '';
    const token = rawToken.startsWith('Bearer ') ? rawToken.slice(7) : rawToken;

    if (!token) return next(new Error('No token provided'));

    try {
      const decoded = jwt.verify(token, secretKey, { algorithms: [tokenAlgorithm] });
      socket.data.userId = parseId(decoded.userId);
      if (!socket.data.userId) return next(new Error('Invalid token'));
      return next();
    } catch {
      return next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('study-session:join', async ({ sessionId } = {}) => {
      const parsedSessionId = parseId(sessionId);
      if (!parsedSessionId) {
        socket.emit('study-session:error', { message: 'Valid session id is required' });
        return;
      }

      try {
        const hasAccess = await model.ensureSessionAccessForUser(
          parsedSessionId,
          socket.data.userId,
        );
        if (!hasAccess) {
          socket.emit('study-session:error', { message: 'You are not invited to this session' });
          return;
        }

        socket.join(sessionRoom(parsedSessionId));
        socket.emit('study-session:joined', {
          sessionId: parsedSessionId,
          userId: socket.data.userId,
        });
      } catch {
        socket.emit('study-session:error', { message: 'Could not join the live session' });
      }
    });
  });

  return io;
}

function emitSessionEvent(sessionId, eventName, payload = {}) {
  if (!io || !sessionId || !eventName) return;
  io.to(sessionRoom(sessionId)).emit(eventName, {
    sessionId,
    ...payload,
  });
}

module.exports = {
  emitSessionEvent,
  initStudySessionRealtime,
};
