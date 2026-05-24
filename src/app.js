const express = require('express');
const createError = require('http-errors');
const path = require('path');

// Import route handlers
const userRoutes = require('./routers/User.router');
const matchRoutes = require('./routers/Match.router');
const studySessionRoutes = require('./routers/StudySession.router');
const chatRoutes = require('./routers/Chat.router');
const homeRoutes = require('./routers/Home.router');
const friendRoutes = require('./routers/Friend.router');
const friendRequestRoutes = require('./routers/FriendRequest.router');
const institutionRoutes = require('./routers/Institution.router');
const diplomaRoutes = require('./routers/Diploma.router');
const badgeRoutes = require('./routers/Badge.router');
const userBadgeRoutes = require('./routers/UserBadge.router');

const moduleRoutes = require('./routers/Module.router');
const userModuleRoutes = require('./routers/UserModule.router');
const prefRoutes = require('./routers/MatchPreference.router');
const languageRoutes = require('./routers/Language.router');

const app = express();

// Parse incoming JSON request bodies (e.g. from POST/PUT requests)
app.use(express.json({ limit: '1mb' }));

// Serve static files (HTML, CSS, JS, images) from the 'public' folder.
// e.g. src/public/index.html is accessible at http://localhost:<port>/
app.use(express.static(path.join(__dirname, 'public')));

// Browsers automatically request /favicon.ico — return 204 (no content) to avoid 404 noise.
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Define routes
app.use('/api/users', userRoutes);
app.use('/api/usermodules', userModuleRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/sessions', studySessionRoutes);
app.use('/api/chats', chatRoutes);

app.use('/api/friends', friendRoutes);
app.use('/api/friendrequest', friendRequestRoutes);
app.use('/api/institution', institutionRoutes);
app.use('/api/diploma', diplomaRoutes);
app.use('/api/badge', badgeRoutes);
app.use('/api/userbadges', userBadgeRoutes);

app.use('/api/modules', moduleRoutes);
app.use('/api/preferences', prefRoutes);

app.use('/api', homeRoutes);
app.use('/api/languages', languageRoutes);

// 404 handler — if no route above matched the request,
// create a 404 error and pass it to the error handler below.
app.use((req, res, next) => {
  next(createError(404, `Unknown resource ${req.method} ${req.originalUrl}`));
});

// Global error handler — catches all errors thrown or passed via next(err).
// Sends a consistent JSON response instead of Express's default HTML error page.
// NOTE: Express requires exactly 4 parameters (error, req, res, next) to recognize
// this as an error handler. 'next' is not used here, so we disable the ESLint rule.
// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
  console.error(error);
  const status = error.status || 500;
  res.status(status).json({ error: error.message });
});

module.exports = app;
