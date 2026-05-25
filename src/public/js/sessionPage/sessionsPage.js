const LIVE_TICK_MS = 1000;
const LIVE_SYNC_MS = 5000;

const sessionsState = {
  sessions: [],
  filter: 'all',
  tickTimer: null,
  syncTimer: null,
  fetchInFlight: false,
};

const sessionsPage = {};

function bindSessionsPage() {
  sessionsPage.alert = document.getElementById('sessionsAlert');
  sessionsPage.empty = document.getElementById('emptySessions');
  sessionsPage.filters = Array.from(document.querySelectorAll('.sessions-filter'));
  sessionsPage.list = document.getElementById('sessionsList');
  sessionsPage.liveMeta = document.getElementById('liveSessionMeta');
  sessionsPage.livePanel = document.getElementById('liveSessionPanel');
  sessionsPage.liveTitle = document.getElementById('liveSessionTitle');
  sessionsPage.openLiveButton = document.getElementById('openLiveSessionButton');
}

function showSessionsAlert(message, type = 'danger') {
  sessionsPage.alert.className = `alert alert-${type}`;
  sessionsPage.alert.textContent = message;
}

function clearSessionsAlert() {
  sessionsPage.alert.className = 'alert d-none';
  sessionsPage.alert.textContent = '';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char];
  });
}

function statusLabel(status) {
  const labels = {
    active: 'Live',
    upcoming: 'Upcoming',
    expired: 'Needs action',
    completed: 'Completed',
  };
  return labels[status] || 'Session';
}

function numericSeconds(value) {
  const seconds = Number(value);
  return Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
}

function secondsSinceFetch(session, now = Date.now()) {
  if (session.status !== 'active') return 0;
  return Math.max(0, Math.floor((now - session.fetched_at_ms) / 1000));
}

function liveRemainingSeconds(session, now = Date.now()) {
  if (session.status !== 'active') return numericSeconds(session.remaining_seconds);
  return Math.max(0, numericSeconds(session.remaining_seconds) - secondsSinceFetch(session, now));
}

function liveElapsedSeconds(session, now = Date.now()) {
  const elapsed = numericSeconds(session.elapsed_seconds) + secondsSinceFetch(session, now);
  const planned = numericSeconds(session.planned_duration_seconds);
  if (session.status !== 'active' || planned <= 0) return elapsed;
  return Math.min(elapsed, planned);
}

function liveProgress(session, now = Date.now()) {
  const planned = numericSeconds(session.planned_duration_seconds);
  if (planned <= 0) return 0;
  return Math.min(Math.max((liveElapsedSeconds(session, now) / planned) * 100, 0), 100);
}

function formatDuration(seconds) {
  const totalSeconds = numericSeconds(seconds);
  if (totalSeconds <= 0) return '-';

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours}h`;
  return `${minutes}m`;
}

function formatTimer(seconds) {
  const totalSeconds = numericSeconds(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainder = totalSeconds % 60;

  if (hours) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
  }

  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function sessionCardDate(session) {
  return session.scheduled_start_at || session.started_at || '';
}

function normalizeSession(session, now = Date.now()) {
  const plannedSeconds = numericSeconds(session.planned_duration_seconds);
  const remainingSeconds = numericSeconds(session.remaining_seconds);
  const elapsedSeconds =
    session.elapsed_seconds === undefined
      ? Math.max(0, plannedSeconds - remainingSeconds)
      : numericSeconds(session.elapsed_seconds);

  return {
    ...session,
    id: session.id,
    session_key:
      session.source === 'calendar'
        ? `calendar-${session.calendar_event_id}`
        : `session-${session.id}`,
    status: String(session.status || 'unknown').toLowerCase(),
    planned_duration_seconds: plannedSeconds,
    remaining_seconds: remainingSeconds,
    elapsed_seconds: elapsedSeconds,
    fetched_at_ms: now,
  };
}

function mergeSessions(nextSessions) {
  const now = Date.now();
  const previousById = new Map(
    sessionsState.sessions.map((session) => [session.session_key, session]),
  );

  return nextSessions.map((session) => {
    const nextSession = normalizeSession(session, now);
    const previousSession = previousById.get(nextSession.session_key);
    const isSameLiveSession =
      previousSession &&
      previousSession.status === 'active' &&
      nextSession.status === 'active' &&
      previousSession.planned_duration_seconds === nextSession.planned_duration_seconds;

    if (!isSameLiveSession) return nextSession;

    return {
      ...nextSession,
      elapsed_seconds: Math.max(nextSession.elapsed_seconds, liveElapsedSeconds(previousSession, now)),
      remaining_seconds: Math.min(
        nextSession.remaining_seconds,
        liveRemainingSeconds(previousSession, now) + 1,
      ),
      fetched_at_ms: now,
    };
  });
}

function sessionAction(session) {
  if (session.status === 'upcoming') {
    return `
      <button class="btn btn-outline-primary" type="button" disabled>
        <i class="fas fa-clock me-2" aria-hidden="true"></i>
        Starts automatically
      </button>
    `;
  }

  if (session.status === 'active' || session.status === 'expired') {
    return `
      <a class="btn btn-primary" href="study-session.html?id=${session.id}">
        <i class="fas fa-arrow-right me-2" aria-hidden="true"></i>
        Open session
      </a>
    `;
  }

  return `
    <a class="btn btn-outline-primary" href="study-session.html?id=${session.id}">
      View summary
    </a>
  `;
}

function sessionGroupChatUrl(sessionId) {
  return `/api/sessions/${sessionId}/chat`;
}

function renderActiveTimeMeta(session) {
  const key = escapeHtml(session.session_key);

  return `
    <div class="session-meta-item">
      <span>Duration</span>
      <strong>${escapeHtml(formatDuration(session.planned_duration_seconds))}</strong>
    </div>
    <div class="session-meta-item">
      <span>Remaining</span>
      <strong data-session-remaining="${key}">${escapeHtml(formatTimer(liveRemainingSeconds(session)))}</strong>
    </div>
  `;
}

function renderInactiveTimeMeta(session) {
  if (session.status === 'upcoming') {
    return `
      <div class="session-meta-item">
        <span>Duration</span>
        <strong>${escapeHtml(formatDuration(session.planned_duration_seconds))}</strong>
      </div>
      <div class="session-meta-item">
        <span>Starts</span>
        <strong>${escapeHtml(formatTime(session.scheduled_start_at))}</strong>
      </div>
    `;
  }

  return `
    <div class="session-meta-item">
      <span>Duration</span>
      <strong>${escapeHtml(formatDuration(session.planned_duration_seconds))}</strong>
    </div>
    <div class="session-meta-item">
      <span>Remaining</span>
      <strong>${escapeHtml(formatTimer(session.remaining_seconds))}</strong>
    </div>
  `;
}

function renderLiveMeter(session) {
  if (session.status !== 'active') return '';
  const key = escapeHtml(session.session_key);
  const planned = numericSeconds(session.planned_duration_seconds);
  const elapsed = liveElapsedSeconds(session);
  const progress = liveProgress(session).toFixed(1);

  return `
    <div
      class="session-live-meter"
      role="progressbar"
      aria-label="Session time progress"
      aria-valuemin="0"
      aria-valuemax="${planned}"
      aria-valuenow="${elapsed}"
      data-session-progress="${key}"
    >
      <span class="session-live-fill" style="width: ${progress}%"></span>
    </div>
  `;
}

function renderSessionCard(session) {
  const status = String(session.status || 'unknown').toLowerCase();
  const goal = session.micro_goal || 'No mission set yet';
  const cardDate = sessionCardDate(session);

  return `
    <article class="premium-card session-card" data-session-card="${escapeHtml(session.session_key)}" data-session-status="${escapeHtml(status)}">
      <div class="session-card-header">
        <div>
          <span class="sessions-status-pill status-${escapeHtml(status)}">${escapeHtml(statusLabel(status))}</span>
          <h2 class="h4 fw-bold mb-1">${escapeHtml(session.title || 'Study session')}</h2>
          <p class="text-muted mb-0">${escapeHtml(goal)}</p>
        </div>
        <time class="session-card-date" datetime="${escapeHtml(cardDate)}">
          ${escapeHtml(formatDate(cardDate))}
        </time>
      </div>

      ${renderLiveMeter(session)}

      <div class="session-meta-grid">
        <div class="session-meta-item">
          <span>Host</span>
          <strong>${escapeHtml(session.host_name || 'Study host')}</strong>
        </div>
        <div class="session-meta-item">
          <span>Members</span>
          <strong>${Number(session.member_count) || 0}</strong>
        </div>
        ${status === 'active' ? renderActiveTimeMeta(session) : renderInactiveTimeMeta(session)}
      </div>

      <div class="session-card-actions">
        ${sessionAction(session)}
        ${
          status === 'upcoming'
            ? ''
            : `<button class="btn btn-white session-chat-button" type="button" data-session-chat-id="${escapeHtml(session.id)}">
                <i class="fas fa-comments me-2" aria-hidden="true"></i>
                Chat
              </button>`
        }
      </div>
    </article>
  `;
}

function filteredSessions() {
  if (sessionsState.filter === 'all') return sessionsState.sessions;
  return sessionsState.sessions.filter((session) => session.status === sessionsState.filter);
}

function renderLivePanel() {
  const liveSession = sessionsState.sessions.find((session) => session.status === 'active');
  sessionsPage.livePanel.classList.toggle('d-none', !liveSession);
  if (!liveSession) {
    delete sessionsPage.livePanel.dataset.sessionId;
    return;
  }

  sessionsPage.livePanel.dataset.sessionId = String(liveSession.id);
  const liveKey = escapeHtml(liveSession.session_key);
  sessionsPage.liveTitle.textContent = liveSession.title || 'Current study session';
  sessionsPage.liveMeta.innerHTML = `
    <span><strong data-live-elapsed="${liveKey}">${escapeHtml(formatTimer(liveElapsedSeconds(liveSession)))}</strong> elapsed</span>
    <span><strong data-live-remaining="${liveKey}">${escapeHtml(formatTimer(liveRemainingSeconds(liveSession)))}</strong> remaining</span>
    <span>${escapeHtml(formatDuration(liveSession.planned_duration_seconds))} planned</span>
    <span>${Number(liveSession.member_count) || 0} members</span>
  `;
  sessionsPage.openLiveButton.href = `study-session.html?id=${liveSession.id}`;
}

function renderSessions() {
  renderLivePanel();

  const sessions = filteredSessions();
  sessionsPage.list.innerHTML = sessions.map(renderSessionCard).join('');
  sessionsPage.empty.classList.toggle('d-none', sessions.length > 0);
  updateLiveTimers();
}

function setFilter(nextFilter) {
  sessionsState.filter = nextFilter;
  sessionsPage.filters.forEach((button) => {
    const isActive = button.dataset.filter === nextFilter;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
  renderSessions();
}

function updateTimedText(selector, value) {
  document.querySelectorAll(selector).forEach((element) => {
    element.textContent = value;
  });
}

function updateLiveTimers() {
  const now = Date.now();

  sessionsState.sessions.forEach((session) => {
    if (session.status !== 'active') return;

    const elapsed = liveElapsedSeconds(session, now);
    const remaining = liveRemainingSeconds(session, now);
    const progress = liveProgress(session, now);
    const key = session.session_key;

    updateTimedText(`[data-session-remaining="${key}"]`, formatTimer(remaining));
    updateTimedText(`[data-live-elapsed="${key}"]`, formatTimer(elapsed));
    updateTimedText(`[data-live-remaining="${key}"]`, formatTimer(remaining));

    document.querySelectorAll(`[data-session-progress="${key}"]`).forEach((meter) => {
      meter.setAttribute('aria-valuenow', String(elapsed));
      const fill = meter.querySelector('.session-live-fill');
      if (fill) fill.style.width = `${progress}%`;
    });
  });
}

async function fetchSessions(options = {}) {
  if (sessionsState.fetchInFlight) return;
  sessionsState.fetchInFlight = true;

  if (!options.silent) clearSessionsAlert();

  try {
    const data = await window.apiRequest('/api/sessions');
    if (data.error || data.message) throw new Error(data.error || data.message);
    sessionsState.sessions = mergeSessions(Array.isArray(data.data) ? data.data : []);
    renderSessions();
  } catch (error) {
    if (!options.silent) showSessionsAlert(error.message || 'Could not load sessions.');
  } finally {
    sessionsState.fetchInFlight = false;
  }
}

async function openSessionChat(event) {
  const button = event.target.closest('.session-chat-button');
  if (!button) return;

  const sessionId = Number(button.dataset.sessionChatId);
  if (!Number.isInteger(sessionId) || sessionId <= 0) return;

  button.disabled = true;
  const previousContent = button.innerHTML;
  button.innerHTML = '<i class="fas fa-spinner fa-spin me-2" aria-hidden="true"></i>Opening...';

  try {
    const chat = await window.apiRequest(sessionGroupChatUrl(sessionId), 'POST');
    if (chat.error || chat.message) throw new Error(chat.error || chat.message);

    const conversationId = chat.data?.conversation_id || chat.conversation_id;
    if (!conversationId) throw new Error('Could not open session chat.');
    window.location.href = `chat.html?conversationId=${encodeURIComponent(conversationId)}`;
  } catch (error) {
    button.disabled = false;
    button.innerHTML = previousContent;
    showSessionsAlert(error.message || 'Could not open session chat.');
  }
}

function startLiveTracking() {
  clearInterval(sessionsState.tickTimer);
  clearInterval(sessionsState.syncTimer);

  sessionsState.tickTimer = setInterval(updateLiveTimers, LIVE_TICK_MS);
  sessionsState.syncTimer = setInterval(() => fetchSessions({ silent: true }), LIVE_SYNC_MS);
}

function bindSessionEvents() {
  sessionsPage.filters.forEach((button) => {
    button.addEventListener('click', () => setFilter(button.dataset.filter));
  });
  sessionsPage.list.addEventListener('click', openSessionChat);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') fetchSessions({ silent: true });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (!window.auth?.isLoggedIn()) {
    window.location.href = 'login.html';
    return;
  }

  bindSessionsPage();
  bindSessionEvents();
  startLiveTracking();
  fetchSessions();
});
