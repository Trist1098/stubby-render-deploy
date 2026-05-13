const DEFAULT_SESSION_ID = 2;
const urlParams = new URLSearchParams(window.location.search);
const selectedId = Number(urlParams.get('id'));
const sessionId = Number.isInteger(selectedId) && selectedId > 0 ? selectedId : DEFAULT_SESSION_ID;
const apiBase = `/api/sessions/${sessionId}`;

let sessionData = createDemoSession();
let timerStartedAt = Date.now();
let timerInterval = null;
let isPreviewMode = false;
const page = {};

// Demo data keeps the page useful even before the database/API is running.
function createDemoSession() {
  const activeGoalTitle = 'Review Chapter 5-7';
  const activeGoalDescription = 'Complete the active FOP2 revision target.';

  return {
    id: sessionId,
    title: 'FOP2 Exam Prep',
    planned_duration_seconds: 2400,
    remaining_seconds: 2270,
    status: 'active',
    micro_goal: {
      ...goal(1, activeGoalTitle, 'active', 60, true, false),
      description: activeGoalDescription,
    },
    queued_micro_goals: [
      {
        id: 4,
        title: 'Plan timed practice set',
        description: 'Queue the next mock-test practice block.',
        queue_position: 4,
        status: 'pending',
      },
    ],
    members: [
      member(2, 'You', 'Focusing', 'focus', 1080, 60, [
        goal(1, activeGoalTitle, 'active', 60, true, false, [
          evidence(1, 'equation', 'T(n) = T(n - 1) + 2n, so T(n) = n(n + 1) + c.'),
        ]),
      ]),
      member(3, 'Alex', 'Need Help', 'need-help', 230, 75, [
        goal(1, activeGoalTitle, 'active', 75, true, false),
        goal(2, 'Finish Tutorial Q1-Q3', 'completed', 100, false, true, [
          evidence(2, 'file', 'Tutorial Q1-Q3 completed document', '/uploads/tutorial-q1-q3.txt'),
        ]),
      ]),
      member(4, 'Sam', 'On Break', 'on-break', 360, 45, [
        goal(1, activeGoalTitle, 'active', 45, true, false),
        goal(3, 'Check recurrence equations', 'completed', 100, false, true, [
          evidence(3, 'equation', 'a_n = 2a_{n-1} + 3, therefore a_n = 2^n a_0 + 3(2^n - 1).'),
        ]),
      ]),
      member(5, 'Emily', 'Reviewing', 'reviewing', 720, 90, [
        goal(1, activeGoalTitle, 'active', 90, true, false),
      ]),
      member(7, 'Alicia', 'Uploading Evidence', 'uploading', 120, 100, [
        goal(1, activeGoalTitle, 'active', 100, true, true, [
          evidence(4, 'image', 'Whiteboard proof sketch', '/uploads/seed-proof-sketch.svg'),
        ]),
      ]),
    ],
  };
}

function member(userId, name, status, statusClass, seconds, progress, goals) {
  return {
    id: userId,
    user_id: userId,
    name,
    current_status: status,
    status_class: statusClass,
    status_timer: seconds,
    progress_percent: progress,
    goals,
  };
}

function goal(id, title, status, progress, isCurrent, isCompleted, evidenceList = []) {
  return {
    id,
    title,
    status,
    progress_percent: progress,
    is_current: isCurrent,
    is_completed: isCompleted,
    evidence: evidenceList,
  };
}

function evidence(id, type, text, url = null) {
  return { id, content_type: type, text_content: text, url };
}

// DOM helpers
function bindPage() {
  page.exitModal = byId('exitModal');
  page.goalDescription = byId('currentGoalDescription');
  page.goalForm = byId('microGoalForm');
  page.goalInput = byId('microGoalTitleInput');
  page.goalTitle = byId('currentGoalTitle');
  page.membersList = byId('membersList');
  page.message = byId('sessionMessage');
  page.nextQueuedGoal = byId('nextQueuedGoal');
  page.queueModal = byId('queueModal');
  page.queuedGoalCount = byId('queuedGoalCount');
  page.queuedGoalsList = byId('queuedGoalsList');
  page.timer = byId('countdownTimer');
  page.title = byId('sessionTitle');
}

function byId(id) {
  return document.getElementById(id);
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

function asPercent(value) {
  return Math.min(Math.max(Number(value) || 0, 0), 100);
}

function initials(name) {
  const letters = String(name || 'U')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  return letters || 'U';
}

function timerText(seconds) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function statusTime(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function fileIcon(type) {
  if (type === 'image') return 'fa-file-image';
  if (type === 'file') return 'fa-file-lines';
  return 'fa-square-root-alt';
}

function showMessage(text, type = 'info') {
  page.message.textContent = text;
  page.message.className = `session-alert session-alert-${type}`;
}

function clearMessage() {
  page.message.textContent = '';
  page.message.className = 'session-alert d-none';
}

function showModal(modal, shouldShow) {
  modal.classList.toggle('d-none', !shouldShow);
}

function emptyText(text, className = 'member-evidence-empty') {
  return `<p class="${className}">${escapeHtml(text)}</p>`;
}

// API helpers
async function getJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const payload = response.status === 204 ? {} : await response.json();
  if (!response.ok) throw new Error(payload.error || 'Request failed');
  return payload.data || payload;
}

async function postForm(url, formData) {
  const response = await fetch(url, { method: 'POST', body: formData });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'Upload failed');
  return payload.data || payload;
}

// Rendering
function renderPage() {
  page.title.textContent = sessionData.title || 'Software Engineering Practice';
  renderCurrentGoal();
  renderMembers();
  startTimer();
}

function renderCurrentGoal() {
  const currentGoal = sessionData.micro_goal;
  page.goalTitle.textContent = currentGoal?.title || 'No micro-goal yet';
  page.goalDescription.textContent =
    currentGoal?.description || 'Add one task to focus this session.';
  renderGoalQueue();
}

function renderGoalQueue() {
  const queuedGoals = sessionData.queued_micro_goals || [];
  const nextGoal = queuedGoals[0];

  page.queuedGoalCount.textContent = queuedGoals.length;
  page.nextQueuedGoal.classList.toggle('d-none', !nextGoal);
  page.nextQueuedGoal.innerHTML = nextGoal
    ? `<span>Next in queue</span><strong>${escapeHtml(nextGoal.title)}</strong>`
    : '';

  page.queuedGoalsList.innerHTML = queuedGoals.length
    ? queuedGoals.map(renderQueuedGoal).join('')
    : emptyText('No queued micro-goals yet.', 'empty-members');
}

function renderQueuedGoal(queuedGoal) {
  return `
    <article class="queued-goal-item">
      <span>${queuedGoal.queue_position || '-'}</span>
      <div>
        <strong>${escapeHtml(queuedGoal.title)}</strong>
        <p>${escapeHtml(queuedGoal.description || 'Queued micro-goal')}</p>
      </div>
    </article>
  `;
}

function renderMembers() {
  const members = sessionData.members || [];

  page.membersList.innerHTML = members.length
    ? members.map(renderMemberCard).join('')
    : emptyText('No members in this session yet.', 'empty-members');
}

function renderMemberCard(memberData) {
  const progress = asPercent(memberData.progress_percent);
  const statusClass = memberData.status_class || 'focusing';

  return `
    <article class="session-member-card status-${escapeHtml(statusClass)}">
      <div class="member-card-summary">
        <div class="member-avatar">${initials(memberData.name)}</div>
        <div class="member-main">
          <div class="member-name-row">
            <strong>${escapeHtml(memberData.name || 'Member')}</strong>
            <span class="member-status status-${escapeHtml(statusClass)}">
              ${escapeHtml(memberData.current_status || 'Focusing')}
            </span>
          </div>
          <div class="member-meta-row">
            <span>${statusTime(memberData.status_timer)} in status</span>
            <span>${progress}%</span>
          </div>
          <div class="member-progress-bar" aria-label="Goal progress ${progress}%">
            <span style="width: ${progress}%"></span>
          </div>
        </div>
      </div>
      <details class="member-details">
        <summary>
          <span>Micro-goals & uploads</span>
          <i class="fas fa-chevron-down"></i>
        </summary>
        ${renderMemberGoals(memberData)}
      </details>
    </article>
  `;
}

function renderMemberGoals(memberData) {
  const goals = memberData.goals || [];
  const activeGoals = goals.filter((item) => item.is_current || item.status === 'active');
  const completedGoals = goals.filter((item) => item.is_completed || item.status === 'completed');

  return `
    ${renderGoalSection('Doing now', activeGoals, memberData, 'No active micro-goal yet.', true)}
    ${renderGoalSection('Completed', completedGoals, memberData, 'No completed micro-goals yet.')}
  `;
}

function renderGoalSection(title, goals, memberData, emptyMessage, allowUpload = false) {
  const content = goals.length
    ? goals.map((item) => renderGoalCard(item, memberData, allowUpload)).join('')
    : emptyText(emptyMessage);

  return `
    <div class="member-goal-section">
      <h4>${title}</h4>
      ${content}
    </div>
  `;
}

function renderGoalCard(goalData, memberData, allowUpload) {
  const progress = asPercent(goalData.progress_percent);

  return `
    <article class="member-goal-card">
      <div class="member-goal-heading">
        <div>
          <span class="member-goal-status">${escapeHtml(goalData.status || 'active')}</span>
          <strong>${escapeHtml(goalData.title || 'Micro-goal')}</strong>
        </div>
        <span>${progress}%</span>
      </div>
      <div class="member-progress-bar member-goal-progress" aria-label="Goal progress ${progress}%">
        <span style="width: ${progress}%"></span>
      </div>
      <div class="member-evidence-list">${renderEvidenceList(goalData.evidence || [])}</div>
      ${allowUpload ? renderEvidenceForm(memberData, goalData) : ''}
    </article>
  `;
}

function renderEvidenceList(evidenceList) {
  return evidenceList.length
    ? evidenceList.map(renderEvidenceItem).join('')
    : emptyText('No evidence uploaded yet.');
}

function renderEvidenceItem(item) {
  const type = item.content_type || 'equation';
  const url = item.url || item.image_url;
  const label = escapeHtml(
    item.text_content || (type === 'image' ? 'Image upload' : 'Document upload'),
  );

  if (type === 'equation') {
    return `
      <div class="evidence-equation">
        <i class="fas ${fileIcon(type)}"></i>
        <code>${label}</code>
      </div>
    `;
  }

  return `
    <a class="evidence-chip evidence-${escapeHtml(type)}" href="${escapeHtml(url || '#')}" target="_blank" rel="noreferrer">
      ${type === 'image' && url
      ? `<img src="${escapeHtml(url)}" alt="${label}" />`
      : `<i class="fas ${fileIcon(type)}"></i>`
    }
      <span>${label}</span>
    </a>
  `;
}

function renderEvidenceForm(memberData, goalData) {
  return `
    <form class="evidence-upload-form" data-user-id="${memberData.user_id}" data-goal-id="${goalData.id}">
      <label>
        <span>Equation or completion note</span>
        <textarea name="equation_text" rows="2" placeholder="e.g. x = (-b +/- sqrt(b^2 - 4ac)) / 2a"></textarea>
      </label>
      <div class="evidence-upload-row">
        <input name="evidence_file" type="file" accept="image/*,.pdf,.doc,.docx,.txt" />
        <button type="submit">
          <i class="fas fa-upload"></i>
          <span>Upload</span>
        </button>
      </div>
    </form>
  `;
}

function startTimer() {
  clearInterval(timerInterval);
  renderTimer();
  timerInterval = setInterval(renderTimer, 1000);
}

function renderTimer() {
  const elapsedSeconds = Math.floor((Date.now() - timerStartedAt) / 1000);
  page.timer.textContent = timerText(Number(sessionData.remaining_seconds || 0) - elapsedSeconds);
}

// Actions
async function loadSession() {
  clearMessage();

  try {
    sessionData = await getJson(apiBase);
    isPreviewMode = false;
  } catch {
    sessionData = createDemoSession();
    isPreviewMode = true;
    showMessage('Showing static preview data until a session is available.', 'info');
  }

  timerStartedAt = Date.now();
  localStorage.setItem('currentStudySessionId', String(sessionId));
  renderPage();
}

async function addMicroGoal(event) {
  event.preventDefault();

  const title = page.goalInput.value.trim();
  if (!title) return;

  try {
    await getJson(`${apiBase}/micro-goals`, {
      method: 'POST',
      body: JSON.stringify({
        title,
        description: 'Current task for this study session.',
        created_by_user_id: 1,
      }),
    });
    resetGoalForm();
    await loadSession();
  } catch {
    addPreviewGoal(title);
  }
}

function addPreviewGoal(title) {
  const queue = sessionData.queued_micro_goals || [];

  sessionData.queued_micro_goals = [
    ...queue,
    {
      id: Date.now(),
      title,
      description: 'Current task for this study session.',
      queue_position: queue.length + 2,
      status: 'pending',
    },
  ];

  resetGoalForm();
  showMessage('Micro-goal added to the static preview queue.', 'info');
  renderCurrentGoal();
}

function resetGoalForm() {
  page.goalForm.reset();
  page.goalForm.classList.add('d-none');
}

async function uploadEvidence(event) {
  if (!event.target.classList.contains('evidence-upload-form')) return;
  event.preventDefault();

  const form = event.target;
  const equationText = form.elements.equation_text.value.trim();
  const file = form.elements.evidence_file.files[0];

  if (!equationText && !file) {
    showMessage('Add an equation, document, or image before uploading.', 'danger');
    return;
  }

  if (isPreviewMode) {
    addPreviewEvidence(form, equationText, file);
    return;
  }

  try {
    const formData = new FormData(form);
    formData.set('user_id', form.dataset.userId);
    await postForm(`${apiBase}/micro-goals/${form.dataset.goalId}/evidence`, formData);
    form.reset();
    await loadSession();
  } catch (error) {
    showMessage(error.message, 'danger');
  }
}

function addPreviewEvidence(form, equationText, file) {
  const memberData = (sessionData.members || []).find(
    (item) => Number(item.user_id) === Number(form.dataset.userId),
  );
  const goalData = memberData?.goals?.find(
    (item) => Number(item.id) === Number(form.dataset.goalId),
  );

  if (!goalData) {
    showMessage('Choose an active micro-goal before uploading evidence.', 'danger');
    return;
  }

  goalData.evidence = goalData.evidence || [];
  if (equationText) goalData.evidence.push(evidence(Date.now(), 'equation', equationText));
  if (file) {
    goalData.evidence.push(
      evidence(
        Date.now() + 1,
        file.type.startsWith('image/') ? 'image' : 'file',
        file.name,
        URL.createObjectURL(file),
      ),
    );
  }

  goalData.progress_percent = 100;
  goalData.is_completed = true;
  memberData.progress_percent = 100;
  form.reset();
  showMessage('Evidence added to the static preview.', 'info');
  renderMembers();
}

async function exitSession() {
  try {
    await getJson(`${apiBase}/exit`, { method: 'PATCH' });
  } catch (error) {
    console.info('Static exit fallback:', error.message);
  }

  window.location.href = 'sessions.html';
}

// Events
document.addEventListener('DOMContentLoaded', () => {
  bindPage();

  byId('showGoalFormButton').addEventListener('click', () => {
    page.goalForm.classList.toggle('d-none');
    if (!page.goalForm.classList.contains('d-none')) page.goalInput.focus();
  });

  page.goalForm.addEventListener('submit', addMicroGoal);
  page.membersList.addEventListener('submit', uploadEvidence);

  byId('exitSessionButton').addEventListener('click', () => showModal(page.exitModal, true));
  byId('cancelExitButton').addEventListener('click', () => showModal(page.exitModal, false));
  byId('confirmExitButton').addEventListener('click', exitSession);

  byId('viewQueueButton').addEventListener('click', () => showModal(page.queueModal, true));
  byId('closeQueueButton').addEventListener('click', () => showModal(page.queueModal, false));

  page.exitModal.addEventListener('click', (event) => {
    if (event.target === page.exitModal) showModal(page.exitModal, false);
  });
  page.queueModal.addEventListener('click', (event) => {
    if (event.target === page.queueModal) showModal(page.queueModal, false);
  });

  loadSession();
});
