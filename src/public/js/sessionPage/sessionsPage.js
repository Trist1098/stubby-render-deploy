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

function normalizeSession(session, now = Date.now()) {
  const plannedSeconds = numericSeconds(session.planned_duration_seconds);
  const remainingSeconds = numericSeconds(session.remaining_seconds);
  const elapsedSeconds =
    session.elapsed_seconds === undefined
      ? Math.max(0, plannedSeconds - remainingSeconds)
      : numericSeconds(session.elapsed_seconds);

  return {
    ...session,
    id: Number(session.id),
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
    sessionsState.sessions.map((session) => [String(session.id), session]),
  );

  return nextSessions.map((session) => {
    const nextSession = normalizeSession(session, now);
    const previousSession = previousById.get(String(nextSession.id));
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

function renderActiveTimeMeta(session) {
  return `
    <div class="session-meta-item">
      <span>Duration</span>
      <strong>${escapeHtml(formatDuration(session.planned_duration_seconds))}</strong>
    </div>
    <div class="session-meta-item">
      <span>Remaining</span>
      <strong data-session-remaining="${session.id}">${escapeHtml(formatTimer(liveRemainingSeconds(session)))}</strong>
    </div>
  `;
}

function renderInactiveTimeMeta(session) {
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
      data-session-progress="${session.id}"
    >
      <span class="session-live-fill" style="width: ${progress}%"></span>
    </div>
  `;
}

function renderSessionCard(session) {
  const status = String(session.status || 'unknown').toLowerCase();
  const goal = session.micro_goal || 'No mission set yet';

  return `
    <article class="premium-card session-card" data-session-card="${session.id}" data-session-status="${escapeHtml(status)}">
      <div class="session-card-header">
        <div>
          <span class="sessions-status-pill status-${escapeHtml(status)}">${escapeHtml(statusLabel(status))}</span>
          <h2 class="h4 fw-bold mb-1">${escapeHtml(session.title || 'Study session')}</h2>
          <p class="text-muted mb-0">${escapeHtml(goal)}</p>
        </div>
        <time class="session-card-date" datetime="${escapeHtml(session.started_at || '')}">
          ${escapeHtml(formatDate(session.started_at))}
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
        <a class="btn btn-white" href="chat.html">
          <i class="fas fa-comments me-2" aria-hidden="true"></i>
          Chat
        </a>
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
  sessionsPage.liveTitle.textContent = liveSession.title || 'Current study session';
  sessionsPage.liveMeta.innerHTML = `
    <span><strong data-live-elapsed="${liveSession.id}">${escapeHtml(formatTimer(liveElapsedSeconds(liveSession)))}</strong> elapsed</span>
    <span><strong data-live-remaining="${liveSession.id}">${escapeHtml(formatTimer(liveRemainingSeconds(liveSession)))}</strong> remaining</span>
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

    updateTimedText(`[data-session-remaining="${session.id}"]`, formatTimer(remaining));
    updateTimedText(`[data-live-elapsed="${session.id}"]`, formatTimer(elapsed));
    updateTimedText(`[data-live-remaining="${session.id}"]`, formatTimer(remaining));

    document.querySelectorAll(`[data-session-progress="${session.id}"]`).forEach((meter) => {
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
