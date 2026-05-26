const app = require('./app');
const http = require('http');
const { initStudySessionRealtime } = require('./realtime/studySessionRealtime');

const port = process.env.PORT || 3000;
const server = http.createServer(app);

initStudySessionRealtime(server);

server.listen(port, () => {
  console.log(`App listening on port ${port}`);
});

// Graceful shutdown
process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
