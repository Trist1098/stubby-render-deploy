const params = new URLSearchParams(window.location.search);
const selectedSessionId = Number(params.get('id'));
const sessionId =
  Number.isInteger(selectedSessionId) && selectedSessionId > 0 ? selectedSessionId : null;

const demoSession = {
  id: sessionId,
  title: 'Software Engineering Practice',
  planned_duration_seconds: 2400,
  remaining_seconds: 2270,
  started_at: new Date(Date.now() - 130000).toISOString(),
  status: 'active',
  micro_goal: {
    id: 1,
    title: 'Finish Tutorial Q1-Q3',
    description: 'Current task for this study session.',
  },
  queued_micro_goals: [
    {
      id: 2,
      title: 'Review API route tests',
      description: 'Queued until the current micro-goal timer ends.',
      queue_position: 2,
      status: 'pending',
    },
    {
      id: 3,
      title: 'Refactor controller validation',
      description: 'Queued until earlier micro-goals finish.',
      queue_position: 3,
      status: 'pending',
    },
  ],
  members: [],
};

let sessionState = demoSession;
let countdownInterval = null;
let countdownStartedAt = Date.now();

const titleEl = document.getElementById('sessionTitle');
const timerEl = document.getElementById('countdownTimer');
const goalTitleEl = document.getElementById('currentGoalTitle');
const goalDescriptionEl = document.getElementById('currentGoalDescription');
const nextQueuedGoalEl = document.getElementById('nextQueuedGoal');
const queuedGoalCountEl = document.getElementById('queuedGoalCount');
const queuedGoalsListEl = document.getElementById('queuedGoalsList');
const membersListEl = document.getElementById('membersList');
const messageEl = document.getElementById('sessionMessage');
const goalFormEl = document.getElementById('microGoalForm');
const goalInputEl = document.getElementById('microGoalTitleInput');
const exitModalEl = document.getElementById('exitModal');
const queueModalEl = document.getElementById('queueModal');

const showMessage = (message, type = 'info') => {
  messageEl.textContent = message;
  messageEl.className = `session-alert session-alert-${type}`;
};

const hideMessage = () => {
  messageEl.textContent = '';
  messageEl.className = 'session-alert d-none';
};

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const payload = response.status === 204 ? {} : await response.json();
  if (!response.ok) throw new Error(payload.error || 'Request failed');
  return payload.data || payload;
};

const initials = (name) =>
  String(name || 'U')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

const formatTimer = (seconds) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
};

const remainingSeconds = () => {
  const elapsed = Math.floor((Date.now() - countdownStartedAt) / 1000);
  return Number(sessionState.remaining_seconds || 0) - elapsed;
};

const renderTimer = () => {
  timerEl.textContent = formatTimer(remainingSeconds());
};

const startTimer = () => {
  if (countdownInterval) clearInterval(countdownInterval);
  renderTimer();
  countdownInterval = setInterval(renderTimer, 1000);
};

const renderGoal = () => {
  const goal = sessionState.micro_goal;
  goalTitleEl.textContent = goal?.title || 'No micro-goal yet';
  goalDescriptionEl.textContent = goal?.description || 'Add one task to focus this session.';
  renderQueuedGoals();
};

const renderQueuedGoals = () => {
  const queuedGoals = sessionState.queued_micro_goals || [];
  const nextGoal = queuedGoals[0];

  queuedGoalCountEl.textContent = queuedGoals.length;

  if (nextGoal) {
    nextQueuedGoalEl.classList.remove('d-none');
    nextQueuedGoalEl.innerHTML = `
      <span>Next in queue</span>
      <strong>${nextGoal.title}</strong>
    `;
  } else {
    nextQueuedGoalEl.classList.add('d-none');
    nextQueuedGoalEl.innerHTML = '';
  }

  if (!queuedGoals.length) {
    queuedGoalsListEl.innerHTML = '<p class="empty-members">No queued micro-goals yet.</p>';
    return;
  }

  queuedGoalsListEl.innerHTML = queuedGoals
    .map(
      (goal) => `
        <article class="queued-goal-item">
          <span>${goal.queue_position || '-'}</span>
          <div>
            <strong>${goal.title}</strong>
            <p>${goal.description || 'Queued micro-goal'}</p>
          </div>
        </article>
      `,
    )
    .join('');
};

const renderMembers = () => {
  const members = sessionState.members || [];

  if (!members.length) {
    membersListEl.innerHTML = '<p class="empty-members">No members in this session yet.</p>';
    return;
  }

  membersListEl.innerHTML = members
    .map((member) => {
      return `
                <article class="session-member-card ${member.status_class === 'need-help' ? 'needs-help' : ''}">
                    <div class="member-avatar">${initials(member.name)}</div>
                    <div class="member-main">
                        <div class="member-name-row">
                            <strong>${member.name || 'Member'}</strong>
                            <span class="member-status">${member.current_status || 'Focusing'}</span>
                        </div>
                        <div class="member-progress-label">
                            <span>Goal-progress</span>
                            <span>${member.progress_percent}%</span>
                        </div>
                        <div class="member-progress-bar" aria-label="Goal progress ${member.progress_percent}%">
                            <span style="width: ${member.progress_percent}%"></span>
                        </div>
                    </div>
                </article>
            `;
    })
    .join('');
};

const renderPage = () => {
  titleEl.textContent = sessionState.title || 'Software Engineering Practice';
  renderGoal();
  renderMembers();
  startTimer();
};

const loadSession = async () => {
  hideMessage();

  if (!sessionId) {
    sessionState = demoSession;
    showMessage('Showing static preview data until a session is available.', 'info');
    countdownStartedAt = Date.now();
    renderPage();
    return;
  }

  try {
    sessionState = await requestJson(`/api/sessions/${sessionId}`);
  } catch {
    sessionState = demoSession;
    showMessage('Showing static preview data until a session is available.', 'info');
  }

  countdownStartedAt = Date.now();
  localStorage.setItem('currentStudySessionId', String(sessionId));
  renderPage();
};

const addMicroGoal = async (event) => {
  event.preventDefault();

  const title = goalInputEl.value.trim();
  if (!title) return;

  if (!sessionId) {
    sessionState.queued_micro_goals = [
      ...(sessionState.queued_micro_goals || []),
      {
        queue_position: (sessionState.queued_micro_goals || []).length + 2,
        id: Date.now(),
        title,
        description: 'Current task for this study session.',
      },
    ];
    goalFormEl.reset();
    goalFormEl.classList.add('d-none');
    showMessage('Micro-goal added to the static preview queue.', 'info');
    renderGoal();
    return;
  }

  try {
    await requestJson(`/api/sessions/${sessionId}/micro-goals`, {
      method: 'POST',
      body: JSON.stringify({
        title,
        description: 'Current task for this study session.',
        created_by_user_id: 1,
      }),
    });

    goalFormEl.reset();
    goalFormEl.classList.add('d-none');
    hideMessage();
    await loadSession();
  } catch {
    sessionState.queued_micro_goals = [
      ...(sessionState.queued_micro_goals || []),
      {
        queue_position: (sessionState.queued_micro_goals || []).length + 2,
        id: Date.now(),
        title,
        description: 'Current task for this study session.',
      },
    ];
    goalFormEl.reset();
    goalFormEl.classList.add('d-none');
    showMessage('Micro-goal added to the static preview queue.', 'info');
    renderGoal();
  }
};

const exitSession = async () => {
  if (!sessionId) {
    window.location.href = 'sessions.html';
    return;
  }

  try {
    await requestJson(`/api/sessions/${sessionId}/exit`, { method: 'PATCH' });
  } catch (error) {
    console.info('Static exit fallback:', error.message);
  }

  window.location.href = 'sessions.html';
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('showGoalFormButton').addEventListener('click', () => {
    goalFormEl.classList.toggle('d-none');
    if (!goalFormEl.classList.contains('d-none')) goalInputEl.focus();
  });

  goalFormEl.addEventListener('submit', addMicroGoal);
  document.getElementById('exitSessionButton').addEventListener('click', () => {
    exitModalEl.classList.remove('d-none');
  });
  document.getElementById('cancelExitButton').addEventListener('click', () => {
    exitModalEl.classList.add('d-none');
  });
  document.getElementById('confirmExitButton').addEventListener('click', exitSession);
  document.getElementById('viewQueueButton').addEventListener('click', () => {
    queueModalEl.classList.remove('d-none');
  });
  document.getElementById('closeQueueButton').addEventListener('click', () => {
    queueModalEl.classList.add('d-none');
  });

  exitModalEl.addEventListener('click', (event) => {
    if (event.target === exitModalEl) exitModalEl.classList.add('d-none');
  });
  queueModalEl.addEventListener('click', (event) => {
    if (event.target === queueModalEl) queueModalEl.classList.add('d-none');
  });

  loadSession();
});
