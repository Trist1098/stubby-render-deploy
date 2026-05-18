const DEFAULT_SESSION_ID = 2;
const CURRENT_USER_ID = 2;
const urlParams = new URLSearchParams(window.location.search);
const selectedId = Number(urlParams.get('id'));
const sessionId = Number.isInteger(selectedId) && selectedId > 0 ? selectedId : DEFAULT_SESSION_ID;
const apiBase = `/api/sessions/${sessionId}`;
const MEMBER_PREVIEW_LIMIT = 3;

let sessionData = createDemoSession();
let timerStartedAt = Date.now();
let timerInterval = null;
let statusTimerInterval = null;
let activeProgressDrag = null;
let isPreviewMode = false;
let membersExpanded = false;
const page = {};

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

function bindPage() {
  page.exitModal = byId('exitModal');
  page.completionForm = byId('completionEvidenceForm');
  page.completionModal = byId('completionModal');
  page.consultationModal = byId('consultationModal');
  page.consultationMemberName = byId('consultationMemberName');
  page.goalDescription = byId('currentGoalDescription');
  page.goalForm = byId('microGoalForm');
  page.goalInput = byId('microGoalTitleInput');
  page.goalTitle = byId('currentGoalTitle');
  page.memberGoalsModal = byId('memberGoalsModal');
  page.memberGoalsModalContent = byId('memberGoalsModalContent');
  page.memberGoalsModalTitle = byId('memberGoalsModalTitle');
  page.membersList = byId('membersList');
  page.membersToggle = byId('membersToggleButton');
  page.message = byId('sessionMessage');
  page.nextQueuedGoal = byId('nextQueuedGoal');
  page.queueModal = byId('queueModal');
  page.queuedGoalCount = byId('queuedGoalCount');
  page.queuedGoalsList = byId('queuedGoalsList');
  page.timer = byId('countdownTimer');
  page.title = byId('sessionTitle');
  page.statusControls = Array.from(document.querySelectorAll('.status-control'));
  page.statusProgressBar = byId('statusProgressBar');
  page.statusProgressFill = byId('statusProgressFill');
  page.statusProgressHint = byId('statusProgressHint');
  page.statusProgressText = byId('statusProgressText');
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

function renderPage() {
  page.title.textContent = sessionData.title || 'Software Engineering Practice';
  renderCurrentGoal();
  renderMembers();
  renderStatusControls();
  renderStatusProgress();
  startTimer();
  startStatusTimer();
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
  const visibleMembers = membersExpanded ? members : members.slice(0, MEMBER_PREVIEW_LIMIT);

  page.membersList.innerHTML = members.length
    ? visibleMembers.map(renderMemberCard).join('')
    : emptyText('No members in this session yet.', 'empty-members');

  page.membersToggle.classList.toggle('d-none', members.length <= MEMBER_PREVIEW_LIMIT);
  page.membersToggle.textContent = membersExpanded ? 'Show less' : `Show all ${members.length}`;
  page.membersToggle.setAttribute('aria-expanded', String(membersExpanded));
}

function renderStatusControls() {
  const currentMember = getCurrentMember();
  const currentStatus = normalizeStatusForApi(
    currentMember?.status_class || currentMember?.current_status,
  );

  page.statusControls.forEach((button) => {
    const isActive = button.dataset.status === currentStatus;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}

function renderStatusProgress() {
  const currentMember = getCurrentMember();
  const currentGoal = getCurrentMemberGoal();
  const progress = asPercent(currentMember?.progress_percent);
  const isLocked = Boolean(currentGoal?.is_completed || progress >= 100);

  paintProgress(progress);
  page.statusProgressBar.classList.toggle('is-locked', isLocked);
  page.statusProgressBar.setAttribute('aria-disabled', String(isLocked));
  page.statusProgressHint.textContent = isLocked
    ? 'Progress is locked at 100% for this micro-goal.'
    : 'Drag or click the bar to update progress. 100% requires workings or a .txt file.';
}

function renderStatusTimers() {
  document.querySelectorAll('.member-status-time').forEach((timer) => {
    timer.textContent = `${statusTime(currentStatusSeconds(timer))} in status`;
  });
}

function currentStatusSeconds(timer) {
  const baseSeconds = Number(timer.dataset.statusSeconds) || 0;
  const renderedAt = Number(timer.dataset.statusRenderedAt) || Date.now();
  const elapsedSeconds = Math.floor((Date.now() - renderedAt) / 1000);
  return baseSeconds + elapsedSeconds;
}

function syncRenderedStatusTimers() {
  document.querySelectorAll('.session-member-card').forEach((card) => {
    const timer = card.querySelector('.member-status-time');
    const member = (sessionData.members || []).find(
      (item) => Number(item.user_id) === Number(card.dataset.memberUserId),
    );
    if (timer && member) member.status_timer = currentStatusSeconds(timer);
  });
}

function renderMemberCardInPlace(memberData) {
  const card = page.membersList.querySelector(
    `.session-member-card[data-member-user-id="${memberData.user_id}"]`,
  );
  if (!card) {
    renderMembers();
    return;
  }

  card.outerHTML = renderMemberCard(memberData);
  renderStatusTimers();
}

function renderMemberCard(memberData) {
  const progress = asPercent(memberData.progress_percent);
  const statusClass = memberData.status_class || 'focusing';
  const isNeedHelp = normalizeStatusForApi(statusClass) === 'need_help';
  const isCurrentUser = Number(memberData.user_id) === CURRENT_USER_ID;
  const displayName = isCurrentUser ? 'You' : memberData.name || 'Member';
  const avatarText = isCurrentUser ? 'You' : initials(memberData.name);
  const statusSeconds = Math.max(0, Number(memberData.status_timer) || 0);
  const statusDisplay = isNeedHelp
    ? `<button class="member-status status-${escapeHtml(statusClass)} consultation-status-button" type="button" data-consultation-name="${escapeHtml(memberData.name || 'This user')}">${escapeHtml(memberData.current_status || 'Focusing')}</button>`
    : `<span class="member-status status-${escapeHtml(statusClass)}">${escapeHtml(memberData.current_status || 'Focusing')}</span>`;

  return `
    <article class="session-member-card status-${escapeHtml(statusClass)}${isCurrentUser ? ' current-user-card' : ''}" data-member-user-id="${memberData.user_id}">
      <div class="member-card-summary">
        <div class="member-avatar">${escapeHtml(avatarText)}</div>
        <div class="member-main">
          <div class="member-name-row">
            <strong>${escapeHtml(displayName)}</strong>
            ${statusDisplay}
          </div>
          <div class="member-meta-row">
            <span
              class="member-status-time"
              data-status-seconds="${statusSeconds}"
              data-status-rendered-at="${Date.now()}"
            >${statusTime(statusSeconds)} in status</span>
            <span class="member-progress-value">${progress}%</span>
          </div>
          <div class="member-progress-bar" aria-label="Goal progress ${progress}%">
            <span class="member-progress-fill" style="width: ${progress}%"></span>
          </div>
        </div>
      </div>
      <button
        class="member-goals-button"
        type="button"
        data-member-user-id="${memberData.user_id}"
      >
        <span>Micro-goals & uploads</span>
        <i class="fas fa-arrow-up-right-from-square"></i>
      </button>
    </article>
  `;
}

function getCurrentMember() {
  return (sessionData.members || []).find(
    (memberData) => Number(memberData.user_id) === CURRENT_USER_ID,
  );
}

function getCurrentMemberGoal() {
  const currentGoalId = Number(sessionData.micro_goal?.id);
  return (getCurrentMember()?.goals || []).find((item) => Number(item.id) === currentGoalId);
}

function renderMemberGoals(memberData) {
  const goals = memberData.goals || [];
  const activeGoals = goals.filter((item) => item.is_current || item.status === 'active');
  const completedGoals = goals.filter((item) => item.is_completed || item.status === 'completed');
  const canCheckWork = Number(memberData.user_id) === CURRENT_USER_ID;

  return `
    ${renderGoalSection('Doing now', activeGoals, memberData, 'No active micro-goal yet.', canCheckWork)}
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
      ${
        type === 'image' && url
          ? `<img src="${escapeHtml(url)}" alt="${label}" />`
          : `<i class="fas ${fileIcon(type)}"></i>`
      }
      <span>${label}</span>
    </a>
  `;
}

function renderEvidenceForm(memberData, goalData) {
  return `
    <form class="evidence-upload-form work-check-form" data-user-id="${memberData.user_id}" data-goal-id="${goalData.id}">
      <label>
        <span>Written equations or note</span>
        <textarea name="equation_text" rows="2" placeholder="Type workings to check before finishing"></textarea>
      </label>
      <div class="evidence-upload-row">
        <input name="evidence_file" type="file" accept=".txt,text/plain" />
        <button type="submit">
          <i class="fas fa-search"></i>
          <span>Check Work</span>
        </button>
      </div>
      <div class="work-check-feedback d-none" aria-live="polite"></div>
    </form>
  `;
}

function startTimer() {
  clearInterval(timerInterval);
  renderTimer();
  timerInterval = setInterval(renderTimer, 1000);
}

function startStatusTimer() {
  clearInterval(statusTimerInterval);
  renderStatusTimers();
  statusTimerInterval = setInterval(renderStatusTimers, 1000);
}

function renderTimer() {
  const elapsedSeconds = Math.floor((Date.now() - timerStartedAt) / 1000);
  const remainingSeconds = Math.max(0, Number(sessionData.remaining_seconds || 0) - elapsedSeconds);
  const totalSeconds = Math.max(
    remainingSeconds,
    Number(sessionData.planned_duration_seconds || 0),
  );

  page.timer.textContent = timerText(remainingSeconds);
  page.timer.parentElement.style.setProperty(
    '--timer-progress',
    totalSeconds ? `${(remainingSeconds / totalSeconds) * 100}%` : '0%',
  );
}

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

function isTxtFile(file) {
  if (!file) return true;
  return /\.txt$/i.test(file.name) && (!file.type || file.type === 'text/plain');
}

function setWorkCheckLoading(form, isLoading) {
  const button = form.querySelector('button[type="submit"]');
  const label = button?.querySelector('span');
  if (!button || !label) return;

  button.disabled = isLoading;
  label.textContent = isLoading ? 'Checking...' : 'Check Work';
}

function feedbackList(items) {
  return (items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('');
}

function setWorkCheckFeedback(form, feedback) {
  const panel = form.querySelector('.work-check-feedback');
  if (!panel) return;

  panel.className = `work-check-feedback work-check-feedback-${feedback.type || 'info'}`;
  panel.innerHTML = `
    <strong>${escapeHtml(feedback.title || 'AI feedback')}</strong>
    <p>${escapeHtml(feedback.summary || '')}</p>
    ${
      feedback.strengths?.length
        ? `<span>Strengths</span><ul>${feedbackList(feedback.strengths)}</ul>`
        : ''
    }
    ${
      feedback.issues?.length
        ? `<span>Improve</span><ul>${feedbackList(feedback.issues)}</ul>`
        : ''
    }
    ${feedback.next_step ? `<p><b>Next:</b> ${escapeHtml(feedback.next_step)}</p>` : ''}
  `;
}

function setWorkCheckError(form, message) {
  setWorkCheckFeedback(form, {
    type: 'danger',
    title: 'Check work',
    summary: message,
  });
}

async function checkWork(event) {
  const form = event.target;
  if (!form.classList.contains('work-check-form')) return;
  event.preventDefault();

  const equationText = form.elements.equation_text.value.trim();
  const file = form.elements.evidence_file.files[0];

  if (!equationText && !file) {
    setWorkCheckError(form, 'Add written equations or a .txt file before checking work.');
    return;
  }
  if (!isTxtFile(file)) {
    setWorkCheckError(form, 'AI work check currently supports .txt files only.');
    return;
  }

  setWorkCheckLoading(form, true);

  if (isPreviewMode) {
    setWorkCheckError(form, 'AI work check needs a live session.');
    setWorkCheckLoading(form, false);
    return;
  }

  try {
    const formData = new FormData(form);
    formData.set('user_id', form.dataset.userId);
    const feedback = await postForm(
      `${apiBase}/micro-goals/${form.dataset.goalId}/work-check`,
      formData,
    );
    setWorkCheckFeedback(form, { title: 'AI feedback', ...feedback });
  } catch (error) {
    setWorkCheckError(form, error.message);
  } finally {
    setWorkCheckLoading(form, false);
  }
}

function progressFromPointer(event) {
  const rect = page.statusProgressBar.getBoundingClientRect();
  const offset = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
  return Math.round((offset / rect.width) * 100);
}

function paintProgress(progress) {
  page.statusProgressText.textContent = `${progress}%`;
  page.statusProgressFill.style.width = `${progress}%`;
  page.statusProgressBar.style.setProperty('--status-progress', `${progress}%`);
  page.statusProgressBar.setAttribute('aria-valuenow', String(progress));

  const currentCard = page.membersList.querySelector(
    `.session-member-card[data-member-user-id="${CURRENT_USER_ID}"]`,
  );
  const memberProgressValue = currentCard?.querySelector('.member-progress-value');
  const memberProgressBar = currentCard?.querySelector('.member-progress-bar');
  const memberProgressFill = currentCard?.querySelector('.member-progress-fill');

  if (memberProgressValue) memberProgressValue.textContent = `${progress}%`;
  if (memberProgressBar) memberProgressBar.setAttribute('aria-label', `Goal progress ${progress}%`);
  if (memberProgressFill) memberProgressFill.style.width = `${progress}%`;
}

function isProgressLocked() {
  const currentMember = getCurrentMember();
  const currentGoal = getCurrentMemberGoal();
  return Boolean(currentGoal?.is_completed || asPercent(currentMember?.progress_percent) >= 100);
}

function startProgressDrag(event) {
  if (isProgressLocked()) return;

  event.preventDefault();
  activeProgressDrag = {
    pointerId: event.pointerId,
    progress: progressFromPointer(event),
  };
  page.statusProgressBar.classList.add('is-dragging');
  page.statusProgressBar.setPointerCapture?.(event.pointerId);
  paintProgress(activeProgressDrag.progress);
}

function moveProgressDrag(event) {
  if (!activeProgressDrag || activeProgressDrag.pointerId !== event.pointerId) return;

  activeProgressDrag.progress = progressFromPointer(event);
  paintProgress(activeProgressDrag.progress);
}

function finishProgressDrag(event) {
  if (!activeProgressDrag || activeProgressDrag.pointerId !== event.pointerId) return;

  moveProgressDrag(event);
  const progress = activeProgressDrag.progress;
  activeProgressDrag = null;
  page.statusProgressBar.classList.remove('is-dragging');
  if (page.statusProgressBar.hasPointerCapture?.(event.pointerId)) {
    page.statusProgressBar.releasePointerCapture(event.pointerId);
  }
  updateCurrentProgress(progress);
}

function cancelProgressDrag(event) {
  if (!activeProgressDrag || activeProgressDrag.pointerId !== event.pointerId) return;

  activeProgressDrag = null;
  page.statusProgressBar.classList.remove('is-dragging');
  if (page.statusProgressBar.hasPointerCapture?.(event.pointerId)) {
    page.statusProgressBar.releasePointerCapture(event.pointerId);
  }
  renderStatusProgress();
}

function openCompletionModal() {
  const currentGoal = sessionData.micro_goal;
  if (!currentGoal?.id) {
    showMessage('Choose an active micro-goal before completing progress.', 'danger');
    return;
  }

  page.completionForm.dataset.userId = CURRENT_USER_ID;
  page.completionForm.dataset.goalId = currentGoal.id;
  page.completionForm.reset();
  showModal(page.completionModal, true);
}

async function updateCurrentProgress(progress) {
  const currentMember = getCurrentMember();
  const currentGoal = getCurrentMemberGoal();

  if (!currentMember || !sessionData.micro_goal?.id) return;
  if (currentGoal?.is_completed || asPercent(currentMember.progress_percent) >= 100) {
    showMessage('This micro-goal is already locked at 100%.', 'info');
    renderStatusProgress();
    return;
  }
  if (progress >= 100) {
    renderStatusProgress();
    openCompletionModal();
    return;
  }

  syncRenderedStatusTimers();

  if (isPreviewMode) {
    updatePreviewProgress(progress);
    return;
  }

  try {
    const updatedProgress = await getJson(`${apiBase}/micro-goals/${sessionData.micro_goal.id}/progress`, {
      method: 'PATCH',
      body: JSON.stringify({
        user_id: CURRENT_USER_ID,
        progress_percent: progress,
      }),
    });
    updatePreviewProgress(asPercent(updatedProgress.progress_percent));
    clearMessage();
  } catch (error) {
    renderStatusProgress();
    showMessage(error.message, 'danger');
  }
}

function updatePreviewProgress(progress) {
  const currentMember = getCurrentMember();
  const currentGoal = getCurrentMemberGoal();
  if (!currentMember || !currentGoal) return;

  currentMember.progress_percent = progress;
  currentGoal.progress_percent = progress;
  showMessage('Progress updated in the static preview.', 'info');
  renderStatusProgress();
}

async function submitCompletionEvidence(event) {
  event.preventDefault();

  const form = event.target;
  const equationText = form.elements.equation_text.value.trim();
  const file = form.elements.evidence_file.files[0];

  if (!equationText && !file) {
    showMessage('Add your workings or upload a file to mark this as 100%.', 'danger');
    return;
  }
  if (!isTxtFile(file)) {
    showMessage('Only .txt files are supported for completing a micro-goal.', 'danger');
    return;
  }

  if (isPreviewMode) {
    addPreviewEvidence(form, equationText, file);
    showModal(page.completionModal, false);
    renderStatusProgress();
    return;
  }

  try {
    const formData = new FormData(form);
    formData.set('user_id', form.dataset.userId);
    await postForm(`${apiBase}/micro-goals/${form.dataset.goalId}/evidence`, formData);
    form.reset();
    showModal(page.completionModal, false);
    await loadSession();
  } catch (error) {
    showMessage(error.message, 'danger');
  }
}

function normalizeStatusForApi(status) {
  const normalized = String(status || 'focus')
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (normalized === 'focusing') return 'focus';
  if (normalized === 'on_break') return 'break';
  return normalized;
}

async function updateCurrentStatus(event) {
  const button = event.currentTarget;
  const status = button.dataset.status;
  if (!status) return;

  syncRenderedStatusTimers();

  if (isPreviewMode) {
    updatePreviewStatus(status);
    return;
  }

  try {
    const updatedMember = await getJson(`${apiBase}/members/status`, {
      method: 'PATCH',
      body: JSON.stringify({
        user_id: CURRENT_USER_ID,
        status,
      }),
    });
    const currentMember = getCurrentMember();
    if (currentMember) {
      currentMember.current_status = updatedMember.current_status;
      currentMember.status_class = updatedMember.status_class;
      currentMember.status_timer = updatedMember.status_timer || 0;
    }
    renderMemberCardInPlace(currentMember);
    renderStatusControls();
  } catch (error) {
    showMessage(error.message, 'danger');
  }
}

function updatePreviewStatus(status) {
  const currentMember = (sessionData.members || []).find(
    (memberData) => Number(memberData.user_id) === CURRENT_USER_ID,
  );
  if (!currentMember) return;

  const labels = {
    focus: 'Focusing',
    break: 'On Break',
    need_help: 'Need Help',
  };

  currentMember.current_status = labels[status] || 'Focusing';
  currentMember.status_class = status.replace(/_/g, '-');
  currentMember.status_timer = 0;
  showMessage('Status updated in the static preview.', 'info');
  renderMemberCardInPlace(currentMember);
  renderStatusControls();
}

function openConsultationModal(memberName) {
  page.consultationMemberName.textContent = memberName || 'This user';
  showModal(page.consultationModal, true);
}

function handleMemberActivation(event) {
  const button = event.target.closest('.consultation-status-button');
  if (!button) return;

  openConsultationModal(button.dataset.consultationName);
}

function openMemberGoalsModal(userId) {
  const memberData = (sessionData.members || []).find(
    (item) => Number(item.user_id) === Number(userId),
  );
  if (!memberData) return;

  const displayName = Number(memberData.user_id) === CURRENT_USER_ID ? 'You' : memberData.name;

  page.memberGoalsModalTitle.textContent = `${displayName || 'Member'}: Micro-goals & Uploads`;
  page.memberGoalsModalContent.innerHTML = renderMemberGoals(memberData);
  showModal(page.memberGoalsModal, true);
}

function handleMemberGoalsButton(event) {
  const button = event.target.closest('.member-goals-button');
  if (!button) return;

  openMemberGoalsModal(button.dataset.memberUserId);
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
        'file',
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
  renderStatusProgress();
}

async function exitSession() {
  try {
    await getJson(`${apiBase}/exit`, { method: 'PATCH' });
  } catch (error) {
    console.info('Static exit fallback:', error.message);
  }

  window.location.href = 'personal-summary.html';
}

document.addEventListener('DOMContentLoaded', () => {
  bindPage();

  byId('showGoalFormButton').addEventListener('click', () => {
    page.goalForm.classList.toggle('d-none');
    if (!page.goalForm.classList.contains('d-none')) page.goalInput.focus();
  });

  page.goalForm.addEventListener('submit', addMicroGoal);
  page.membersList.addEventListener('click', handleMemberActivation);
  page.membersList.addEventListener('click', handleMemberGoalsButton);
  page.memberGoalsModal.addEventListener('submit', checkWork);
  page.membersToggle.addEventListener('click', () => {
    membersExpanded = !membersExpanded;
    renderMembers();
  });
  page.statusControls.forEach((button) => {
    button.addEventListener('click', updateCurrentStatus);
  });
  page.statusProgressBar.addEventListener('pointerdown', startProgressDrag);
  page.statusProgressBar.addEventListener('pointermove', moveProgressDrag);
  page.statusProgressBar.addEventListener('pointerup', finishProgressDrag);
  page.statusProgressBar.addEventListener('pointercancel', cancelProgressDrag);
  page.completionForm.addEventListener('submit', submitCompletionEvidence);

  byId('exitSessionButton').addEventListener('click', () => showModal(page.exitModal, true));
  byId('cancelExitButton').addEventListener('click', () => showModal(page.exitModal, false));
  byId('confirmExitButton').addEventListener('click', exitSession);
  byId('cancelCompletionButton').addEventListener('click', () =>
    showModal(page.completionModal, false),
  );
  byId('cancelConsultationButton').addEventListener('click', () =>
    showModal(page.consultationModal, false),
  );
  byId('confirmConsultationButton').addEventListener('click', () => {
    showModal(page.consultationModal, false);
    showMessage('Consultation confirmed. Opening the consultation workspace next.', 'info');
  });

  byId('viewQueueButton').addEventListener('click', () => showModal(page.queueModal, true));
  byId('closeQueueButton').addEventListener('click', () => showModal(page.queueModal, false));
  byId('closeMemberGoalsButton').addEventListener('click', () =>
    showModal(page.memberGoalsModal, false),
  );

  page.exitModal.addEventListener('click', (event) => {
    if (event.target === page.exitModal) showModal(page.exitModal, false);
  });
  page.queueModal.addEventListener('click', (event) => {
    if (event.target === page.queueModal) showModal(page.queueModal, false);
  });
  page.consultationModal.addEventListener('click', (event) => {
    if (event.target === page.consultationModal) showModal(page.consultationModal, false);
  });
  page.memberGoalsModal.addEventListener('click', (event) => {
    if (event.target === page.memberGoalsModal) showModal(page.memberGoalsModal, false);
  });
  page.completionModal.addEventListener('click', (event) => {
    if (event.target === page.completionModal) showModal(page.completionModal, false);
  });

  loadSession();
});
