const getCurrentUserId = () => {
  const userId = localStorage.getItem('currentUserId');
  return userId ? Number(userId) : null;
};

const setCurrentUserId = (userId) => {
  localStorage.setItem('currentUserId', String(userId));
};

const clearCurrentUser = () => {
  localStorage.removeItem('currentUserId');
};

const getCurrentStudySessionId = () => {
  const studySessionId = localStorage.getItem('currentStudySessionId');
  return studySessionId ? Number(studySessionId) : null;
};

const setCurrentStudySessionId = (studySessionId) => {
  localStorage.setItem('currentStudySessionId', String(studySessionId));
};

const clearCurrentStudySession = () => {
  localStorage.removeItem('currentStudySessionId');
};

const getQueryParam = (name) => {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
};

const getQueryId = (name) => {
  const value = Number(getQueryParam(name));
  return Number.isInteger(value) && value > 0 ? value : null;
};

const apiData = (payload) => payload?.data;

const apiList = (payload) => {
  const data = apiData(payload);
  return Array.isArray(data) ? data : [];
};

const apiErrorMsg = (payload) => payload?.error || 'Something went wrong';

const safe = (value, fallback = '-') => {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

const formatDuration = (seconds) => {
  if (!seconds) return '-';

  const totalSeconds = Number(seconds);
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '-';

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const setAlert = (alertEl, type, text) => {
  if (!alertEl) return;

  alertEl.className = `app-alert app-alert-${type}`;
  alertEl.textContent = text;
};

const clearAlert = (alertEl) => {
  if (!alertEl) return;

  alertEl.className = 'app-alert d-none';
  alertEl.textContent = '';
};

const makeApiMsg = (alertEl) => ({
  showError: (payload) => setAlert(alertEl, 'danger', apiErrorMsg(payload)),
  showSuccess: (text) => setAlert(alertEl, 'success', text),
  showInfo: (text) => setAlert(alertEl, 'info', text),
  hide: () => clearAlert(alertEl),
});

const setActiveNavLink = () => {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const navLinks = document.querySelectorAll('[data-nav-page]');

  navLinks.forEach((link) => {
    const isActive = link.dataset.navPage === currentPage;
    link.classList.toggle('active', isActive);

    if (isActive) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
};

const updateNavbarState = () => {
  const userId = getCurrentUserId();
  const sessionId = getCurrentStudySessionId();

  const userDisplayEl = document.getElementById('currentUserDisplay');
  const sessionLinkEl = document.getElementById('currentSessionLink');
  const clearUserBtnEl = document.getElementById('clearUserButton');

  if (userDisplayEl) {
    userDisplayEl.textContent = userId ? `User #${userId}` : 'Sign in';
  }

  if (sessionLinkEl) {
    sessionLinkEl.classList.toggle('disabled', !sessionId);
    sessionLinkEl.href = sessionId ? `study-session.html?id=${sessionId}` : '#';
  }

  if (clearUserBtnEl) {
    clearUserBtnEl.classList.toggle('d-none', !userId);
    clearUserBtnEl.addEventListener('click', () => {
      clearCurrentUser();
      window.location.href = 'users.html';
    });
  }
};

const injectNavbar = () => {
  const navbarEl = document.getElementById('appNavbar');
  if (!navbarEl) return;

  navbarEl.innerHTML = `
    <nav class="app-shell-nav">
      <a class="brand-link" href="index.html" aria-label="Study Together home">
        <span class="brand-mark">ST</span>
        <span>Study Together</span>
      </a>

      <button class="nav-toggle" type="button" aria-controls="mainNavigation" aria-expanded="false">
        Menu
      </button>

      <div id="mainNavigation" class="nav-links">
        <a data-nav-page="index.html" href="index.html">Dashboard</a>
        <a data-nav-page="study-sessions.html" href="study-sessions.html">Study Sessions</a>
        <a id="currentSessionLink" data-nav-page="study-session.html" href="#">Current Session</a>
        <a data-nav-page="consultation.html" href="consultation.html">Consultation</a>
        <a data-nav-page="summary.html" href="summary.html">Summary</a>
      </div>

      <div class="nav-user">
        <span id="currentUserDisplay">Sign in</span>
        <button id="clearUserButton" class="ghost-button d-none" type="button">Switch</button>
      </div>
    </nav>
  `;

  const toggleBtn = navbarEl.querySelector('.nav-toggle');
  const navLinksEl = navbarEl.querySelector('#mainNavigation');

  if (toggleBtn && navLinksEl) {
    toggleBtn.addEventListener('click', () => {
      const expanded = toggleBtn.getAttribute('aria-expanded') === 'true';
      toggleBtn.setAttribute('aria-expanded', String(!expanded));
      navLinksEl.classList.toggle('open', !expanded);
    });
  }

  updateNavbarState();
  setActiveNavLink();
};

const injectFooter = () => {
  const footerEl = document.getElementById('appFooter');
  if (!footerEl) return;

  footerEl.innerHTML = `
    <p>Study Together collaborative learning dashboard.</p>
  `;
};

let fetchInFlight = 0;

const injectFetchOverlay = () => {
  if (document.getElementById('fetchOverlay')) return;

  const overlayEl = document.createElement('div');
  overlayEl.id = 'fetchOverlay';
  overlayEl.className = 'fetch-overlay d-none';
  overlayEl.innerHTML = `
    <div class="fetch-card">
      <div class="spinner" aria-hidden="true"></div>
      <span>Loading...</span>
    </div>
  `;

  document.body.appendChild(overlayEl);
};

const showFetchOverlay = () => {
  fetchInFlight++;

  const overlayEl = document.getElementById('fetchOverlay');
  if (overlayEl) overlayEl.classList.remove('d-none');
};

const hideFetchOverlay = () => {
  fetchInFlight = Math.max(0, fetchInFlight - 1);
  if (fetchInFlight !== 0) return;

  const overlayEl = document.getElementById('fetchOverlay');
  if (overlayEl) overlayEl.classList.add('d-none');
};

const createStatusBadge = (status) => {
  const badgeEl = document.createElement('span');
  badgeEl.className = `status-badge status-${safe(status, 'unknown').toLowerCase()}`;
  badgeEl.textContent = safe(status, 'unknown');
  return badgeEl;
};

const initSharedUI = () => {
  injectNavbar();
  injectFooter();
  injectFetchOverlay();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSharedUI);
} else {
  initSharedUI();
}
