const DEFAULT_SESSION_ID = 2;
const CURRENT_USER_ID = 2;
const urlParams = new URLSearchParams(window.location.search);
const selectedId = Number(urlParams.get('id'));
const sessionId = Number.isInteger(selectedId) && selectedId > 0 ? selectedId : DEFAULT_SESSION_ID;
const apiBase = `/api/sessions/${sessionId}`;
const MEMBER_PREVIEW_LIMIT = 3;
const CHECKLIST_STORAGE_PREFIX = 'workCheckChecklist:';

let sessionData = {
  id: sessionId,
  title: 'Study Session',
  planned_duration_seconds: 0,
  remaining_seconds: 0,
  status: 'loading',
  micro_goal: null,
  queued_micro_goals: [],
  members: [],
};
let timerStartedAt = Date.now();
let timerInterval = null;
let statusTimerInterval = null;
let activeProgressDrag = null;
let membersExpanded = false;
let pendingConsultationMemberId = null;
let activeConsultation = null;
let activeWorkspaceTab = 'whiteboard';
let whiteboardContext = null;
let whiteboardDrawing = false;
let whiteboardStrokes = [];
let whiteboardCurrentStroke = null;
let workspaceSaveTimer = null;
let workspacePollTimer = null;
let workspaceSaveInFlight = false;
let workspaceRevision = 0;
let savedWorkspaceRevision = 0;
let lastWorkspaceUpdatedAt = null;
const page = {};

function bindPage() {
  page.exitModal = byId('exitModal');
  page.completionAiFeedback = byId('completionAiFeedback');
  page.completionForm = byId('completionEvidenceForm');
  page.completionModal = byId('completionModal');
  page.consultationContext = byId('consultationContext');
  page.consultationDirectionModal = byId('consultationDirectionModal');
  page.consultationDirectionText = byId('consultationDirectionText');
  page.consultationModal = byId('consultationModal');
  page.consultationMemberName = byId('consultationMemberName');
  page.consultationReviewForm = byId('consultationReviewForm');
  page.consultationReviewModal = byId('consultationReviewModal');
  page.consultationReviewPrompt = byId('consultationReviewPrompt');
  page.consultationWorkspaceModal = byId('consultationWorkspaceModal');
  page.consultationWorkspaceStatus = byId('consultationWorkspaceStatus');
  page.consultationWorkspaceTitle = byId('consultationWorkspaceTitle');
  page.consultationWhiteboard = byId('consultationWhiteboard');
  page.consultationScratchpad = byId('consultationScratchpad');
  page.clearWhiteboardButton = byId('clearWhiteboardButton');
  page.goalDescription = byId('currentGoalDescription');
  page.goalForm = byId('microGoalForm');
  page.goalInput = byId('microGoalTitleInput');
  page.goalQuestionInput = byId('microGoalQuestionInput');
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
  page.rejoinConsultationButton = byId('rejoinConsultationButton');
  page.timer = byId('countdownTimer');
  page.title = byId('sessionTitle');
  page.toastContainer = byId('sessionToastContainer');
  page.statusControls = Array.from(document.querySelectorAll('.status-control'));
  page.statusProgressBar = byId('statusProgressBar');
  page.statusProgressFill = byId('statusProgressFill');
  page.statusProgressHint = byId('statusProgressHint');
  page.statusProgressText = byId('statusProgressText');
  page.workspacePanels = Array.from(document.querySelectorAll('[data-workspace-panel]'));
  page.workspaceTabButtons = Array.from(document.querySelectorAll('[data-workspace-tab]'));
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

function showToast({ title, message, type = 'info', actionLabel = '', action = null }) {
  if (!page.toastContainer) return null;

  const toast = document.createElement(action ? 'button' : 'div');
  toast.className = `session-toast session-toast-${type}`;
  if (action) toast.type = 'button';
  toast.innerHTML = `
    <strong>${escapeHtml(title)}</strong>
    ${message ? `<p>${escapeHtml(message)}</p>` : ''}
    ${actionLabel ? `<span>${escapeHtml(actionLabel)}</span>` : ''}
  `;

  const removeToast = () => toast.remove();
  if (action) {
    toast.addEventListener('click', () => {
      removeToast();
      action();
    });
  }

  page.toastContainer.appendChild(toast);
  window.setTimeout(removeToast, 10000);
  return toast;
}

function isCurrentUserInConsultation() {
  const currentMember = getCurrentMember();
  return (
    normalizeStatusForApi(currentMember?.status_class || currentMember?.current_status) ===
    'in_consultation'
  );
}

function updateRejoinButton() {
  if (!page.rejoinConsultationButton) return;

  const shouldShow =
    activeConsultation &&
    !activeConsultation.ended_at &&
    isCurrentUserInConsultation() &&
    page.consultationWorkspaceModal?.classList.contains('d-none');

  page.rejoinConsultationButton.classList.toggle('d-none', !shouldShow);
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

function workCheckUrl(goalId) {
  return `${apiBase}/micro-goals/${goalId}/work-check`;
}

function workCheckHistoryUrl(goalId, userId) {
  return `${apiBase}/micro-goals/${goalId}/work-checks?user_id=${userId}`;
}

function consultationUrl(consultationId = '') {
  return `${apiBase}/consultations${consultationId ? `/${consultationId}` : ''}`;
}

function consultationFinishUrl(consultationId) {
  return `${consultationUrl(consultationId)}/finish`;
}

function consultationReviewUrl(consultationId) {
  return `${consultationUrl(consultationId)}/review`;
}

function consultationWorkspaceUrl(consultationId) {
  return `${consultationUrl(consultationId)}/workspace`;
}

function renderPage() {
  page.title.textContent = sessionData.title || 'Software Engineering Practice';
  renderCurrentGoal();
  renderMembers();
  renderStatusControls();
  renderStatusProgress();
  updateRejoinButton();
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
  updateRejoinButton();
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
    : 'Drag or click the bar to update progress. 100% requires workings, a .txt file, or a Word .docx file.';
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
  const statusDisplay =
    isNeedHelp && !isCurrentUser
      ? `<button class="member-status status-${escapeHtml(statusClass)} consultation-status-button" type="button" data-consultation-name="${escapeHtml(memberData.name || 'This user')}" data-consultation-user-id="${memberData.user_id}">${escapeHtml(memberData.current_status || 'Focusing')}</button>`
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
  const activeGoals = goals.filter(
    (item) =>
      (item.is_current || item.status === 'active') &&
      !item.is_completed &&
      item.status !== 'completed',
  );
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
  const canSubmit =
    allowUpload && goalData.status === 'active' && !goalData.is_completed && progress < 100;
  const taskText = goalData.description
    ? `<p class="member-goal-task"><span>Question/task</span>${escapeHtml(goalData.description)}</p>`
    : '';

  return `
    <article class="member-goal-card">
      <div class="member-goal-heading">
        <div>
          <span class="member-goal-status">${escapeHtml(goalData.status || 'active')}</span>
          <strong>${escapeHtml(goalData.title || 'Micro-goal')}</strong>
        </div>
        <span>${progress}%</span>
      </div>
      ${taskText}
      <div class="member-progress-bar member-goal-progress" aria-label="Goal progress ${progress}%">
        <span style="width: ${progress}%"></span>
      </div>
      <div class="member-evidence-list">${renderEvidenceList(goalData.evidence || [])}</div>
      ${canSubmit ? renderEvidenceForm(memberData, goalData) : ''}
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
        <textarea name="equation_text" rows="2" placeholder="Type workings or a completion note"></textarea>
      </label>
      <div class="evidence-upload-row">
        <input name="evidence_file" type="file" accept=".txt,.docx,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />
        <div class="evidence-action-group">
          <button class="submit-evidence-button" type="submit" data-action="submit">
            <i class="fas fa-upload"></i>
            <span>Submit</span>
          </button>
          <button class="ai-review-button" type="submit" data-action="review">
            <i class="fas fa-search"></i>
            <span>AI Review</span>
          </button>
        </div>
      </div>
      <div class="work-check-feedback d-none" aria-live="polite"></div>
      <section class="work-check-history" data-user-id="${memberData.user_id}" data-goal-id="${goalData.id}">
        <div class="work-check-history-heading">
          <strong>Previous AI checks</strong>
          <span>Newest first</span>
        </div>
        <div class="work-check-history-list">${emptyText('Loading AI feedback history...', 'work-check-empty')}</div>
      </section>
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
  } catch (error) {
    showMessage(error.message || 'Could not load the live study session.', 'danger');
  }

  timerStartedAt = Date.now();
  localStorage.setItem('currentStudySessionId', String(sessionId));
  renderPage();
}

async function addMicroGoal(event) {
  event.preventDefault();

  const title = page.goalInput.value.trim();
  const description = page.goalQuestionInput.value.trim();
  if (!title || !description) {
    showMessage('Add both a micro-goal label and the question or task.', 'danger');
    return;
  }

  try {
    await getJson(`${apiBase}/micro-goals`, {
      method: 'POST',
      body: JSON.stringify({
        title,
        description,
        created_by_user_id: CURRENT_USER_ID,
      }),
    });
    resetGoalForm();
    await loadSession();
  } catch (error) {
    showMessage(error.message, 'danger');
  }
}

function resetGoalForm() {
  page.goalForm.reset();
  page.goalForm.classList.add('d-none');
}

function isTxtFile(file) {
  if (!file) return true;
  const supportedTypes = [
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  return /\.(txt|docx)$/i.test(file.name) && (!file.type || supportedTypes.includes(file.type));
}

function isSupportedWorkCheckFile(file) {
  if (!file) return true;
  const hasSupportedName = /\.(txt|docx)$/i.test(file.name);
  const hasSupportedType =
    !file.type ||
    [
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ].includes(file.type);
  return hasSupportedName && hasSupportedType;
}

function setWorkCheckLoading(form, isLoading) {
  const button = form.querySelector('.ai-review-button');
  const label = button?.querySelector('span');
  if (!button || !label) return;

  form.querySelectorAll('.evidence-action-group button').forEach((item) => {
    item.disabled = isLoading;
  });
  label.textContent = isLoading ? 'Reviewing...' : 'AI Review';
}

function setEvidenceSubmitLoading(form, isLoading) {
  const button = form.querySelector('.submit-evidence-button');
  const label = button?.querySelector('span');
  if (!button || !label) return;

  form.querySelectorAll('.evidence-action-group button').forEach((item) => {
    item.disabled = isLoading;
  });
  label.textContent = isLoading ? 'Submitting...' : 'Submit';
}

function feedbackList(items) {
  return (items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('');
}

function feedbackStatusLabel(status) {
  const labels = {
    looks_good: 'Looks good',
    needs_more_detail: 'Needs more detail',
    cannot_verify: 'Cannot verify',
  };
  return labels[status] || 'AI feedback';
}

function workCheckChecklistItems(feedback) {
  const items = [...(feedback.issues || [])];
  if (feedback.next_step) items.push(feedback.next_step);
  return [...new Set(items.map((item) => String(item).trim()).filter(Boolean))];
}

function checklistStorageKey(checkId) {
  return `${CHECKLIST_STORAGE_PREFIX}${checkId}`;
}

function readChecklistState(checkId) {
  try {
    return new Set(JSON.parse(localStorage.getItem(checklistStorageKey(checkId))) || []);
  } catch {
    return new Set();
  }
}

function writeChecklistState(checkId, checkedItems) {
  localStorage.setItem(checklistStorageKey(checkId), JSON.stringify(checkedItems));
}

function formatCheckTime(value) {
  if (!value) return 'Just now';
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function renderWorkCheckChecklist(feedback) {
  const items = workCheckChecklistItems(feedback);
  if (!feedback.id || !items.length) return '';

  const checkedItems = readChecklistState(feedback.id);
  const allChecked = items.every((item) => checkedItems.has(item));

  return `
    <fieldset class="work-check-checklist${allChecked ? ' checklist-ready' : ''}" data-check-id="${feedback.id}">
      <legend>Improvement checklist</legend>
      ${items
        .map((item) => {
          const checked = checkedItems.has(item) ? 'checked' : '';
          return `
            <label>
              <input type="checkbox" data-check-text="${escapeHtml(item)}" ${checked} />
              <span>${escapeHtml(item)}</span>
            </label>
          `;
        })
        .join('')}
      <p>${allChecked ? 'Ready to complete when your evidence is prepared.' : 'Tick items as you improve your work.'}</p>
    </fieldset>
  `;
}

function renderWorkCheckCard(feedback, index = 0) {
  const status = feedback.status || 'cannot_verify';
  const fileLabel = feedback.file_name
    ? `<span class="work-check-file">${escapeHtml(feedback.file_type || 'file')}: ${escapeHtml(feedback.file_name)}</span>`
    : '';

  return `
    <details class="work-check-card work-check-${escapeHtml(status)}" ${index === 0 ? 'open' : ''}>
      <summary>
        <span>
          <strong>${feedbackStatusLabel(status)}</strong>
          <small>${formatCheckTime(feedback.created_at)}</small>
        </span>
        <span class="work-check-status">${feedbackStatusLabel(status)}</span>
      </summary>
      <div class="work-check-card-body">
        ${fileLabel}
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
        ${renderWorkCheckChecklist(feedback)}
      </div>
    </details>
  `;
}

function renderWorkCheckHistory(form, feedbackListData) {
  const list = form.querySelector('.work-check-history-list');
  if (!list) return;

  list.innerHTML = feedbackListData.length
    ? feedbackListData.map(renderWorkCheckCard).join('')
    : emptyText('No AI checks yet.', 'work-check-empty');
}

async function loadWorkCheckHistory(form) {
  const list = form.querySelector('.work-check-history-list');
  if (!list) return;

  try {
    const feedbackListData = await getJson(
      workCheckHistoryUrl(form.dataset.goalId, form.dataset.userId),
    );
    renderWorkCheckHistory(form, feedbackListData);
  } catch (error) {
    list.innerHTML = emptyText(error.message, 'work-check-empty work-check-empty-danger');
  }
}

function handleWorkCheckChecklistChange(event) {
  const checkbox = event.target.closest('.work-check-checklist input[type="checkbox"]');
  if (!checkbox) return;

  const checklist = checkbox.closest('.work-check-checklist');
  const checkId = checklist.dataset.checkId;
  const checkedItems = Array.from(checklist.querySelectorAll('input[type="checkbox"]:checked')).map(
    (item) => item.dataset.checkText,
  );
  const allChecked =
    checkedItems.length === checklist.querySelectorAll('input[type="checkbox"]').length;

  writeChecklistState(checkId, checkedItems);
  checklist.classList.toggle('checklist-ready', allChecked);
  checklist.querySelector('p').textContent = allChecked
    ? 'Ready to complete when your evidence is prepared.'
    : 'Tick items as you improve your work.';
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
      feedback.issues?.length ? `<span>Improve</span><ul>${feedbackList(feedback.issues)}</ul>` : ''
    }
    ${feedback.next_step ? `<p><b>Next:</b> ${escapeHtml(feedback.next_step)}</p>` : ''}
    ${renderWorkCheckChecklist(feedback)}
  `;
}

function setWorkCheckError(form, message) {
  setWorkCheckFeedback(form, {
    type: 'danger',
    title: 'Check work',
    summary: message,
  });
}

async function handleEvidenceFormSubmit(event) {
  const form = event.target;
  if (!form.classList.contains('work-check-form')) return;
  event.preventDefault();

  if (event.submitter?.dataset.action === 'submit') {
    await submitMemberGoalEvidence(form);
    return;
  }

  await checkWork(form);
}

async function checkWork(form) {
  const equationText = form.elements.equation_text.value.trim();
  const file = form.elements.evidence_file.files[0];

  if (!equationText && !file) {
    setWorkCheckError(
      form,
      'Add written equations, a .txt file, or a Word .docx file before checking work.',
    );
    return;
  }
  if (!isSupportedWorkCheckFile(file)) {
    setWorkCheckError(form, 'AI work check supports .txt or Word .docx files only.');
    return;
  }

  setWorkCheckLoading(form, true);

  try {
    const formData = new FormData(form);
    formData.set('user_id', form.dataset.userId);
    const feedback = await postForm(workCheckUrl(form.dataset.goalId), formData);
    setWorkCheckFeedback(form, { title: 'AI feedback', ...feedback });
    await loadWorkCheckHistory(form);
  } catch (error) {
    setWorkCheckError(form, error.message);
  } finally {
    setWorkCheckLoading(form, false);
  }
}

async function submitMemberGoalEvidence(form) {
  const equationText = form.elements.equation_text.value.trim();
  const file = form.elements.evidence_file.files[0];

  if (!equationText && !file) {
    setWorkCheckError(form, 'Add your workings or upload a file before submitting.');
    return;
  }
  if (!isTxtFile(file)) {
    setWorkCheckError(form, 'Only .txt or Word .docx files are supported for submitting evidence.');
    return;
  }

  setEvidenceSubmitLoading(form, true);

  try {
    const formData = new FormData(form);
    formData.set('user_id', form.dataset.userId);
    await postForm(`${apiBase}/micro-goals/${form.dataset.goalId}/evidence`, formData);
    form.reset();
    await loadSession();
    showMessage('Evidence submitted. Moving to the next queued micro-goal.', 'info');
    openMemberGoalsModal(form.dataset.userId);
  } catch (error) {
    setWorkCheckError(form, error.message);
  } finally {
    setEvidenceSubmitLoading(form, false);
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

function setCompletionAiFeedback(feedback) {
  if (!page.completionAiFeedback) return;

  if (!feedback) {
    page.completionAiFeedback.className = 'completion-ai-feedback completion-ai-feedback-info';
    page.completionAiFeedback.innerHTML =
      '<strong>No AI check saved yet</strong><p>You can still submit your workings to complete this micro-goal.</p>';
    return;
  }

  const status = feedback.status || 'cannot_verify';
  const tone = status === 'looks_good' ? 'success' : 'warning';
  const statusCopy = {
    looks_good: 'Latest AI check looks good',
    needs_more_detail: 'Latest AI check needs more detail',
    cannot_verify: 'Latest AI check cannot verify yet',
  };

  page.completionAiFeedback.className = `completion-ai-feedback completion-ai-feedback-${tone}`;
  page.completionAiFeedback.innerHTML = `
    <strong>${escapeHtml(statusCopy[status] || 'Latest AI feedback')}</strong>
    <p>${escapeHtml(feedback.summary || '')}</p>
    ${feedback.issues?.length ? `<ul>${feedbackList(feedback.issues)}</ul>` : ''}
    ${feedback.next_step ? `<p><b>Next:</b> ${escapeHtml(feedback.next_step)}</p>` : ''}
  `;
}

async function loadCompletionAiFeedback(goalId) {
  if (!page.completionAiFeedback) return;

  page.completionAiFeedback.className = 'completion-ai-feedback completion-ai-feedback-info';
  page.completionAiFeedback.innerHTML = '<strong>Loading latest AI feedback...</strong>';

  try {
    const feedbackListData = await getJson(workCheckHistoryUrl(goalId, CURRENT_USER_ID));
    setCompletionAiFeedback(feedbackListData[0] || null);
  } catch (error) {
    page.completionAiFeedback.className = 'completion-ai-feedback completion-ai-feedback-warning';
    page.completionAiFeedback.innerHTML = `<strong>Could not load latest AI feedback</strong><p>${escapeHtml(error.message)}</p>`;
  }
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
  loadCompletionAiFeedback(currentGoal.id);
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

  try {
    const updatedProgress = await getJson(
      `${apiBase}/micro-goals/${sessionData.micro_goal.id}/progress`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          user_id: CURRENT_USER_ID,
          progress_percent: progress,
        }),
      },
    );
    applyCurrentProgress(asPercent(updatedProgress.progress_percent));
    clearMessage();
  } catch (error) {
    renderStatusProgress();
    showMessage(error.message, 'danger');
  }
}

function applyCurrentProgress(progress) {
  const currentMember = getCurrentMember();
  const currentGoal = getCurrentMemberGoal();
  if (!currentMember || !currentGoal) return;

  currentMember.progress_percent = progress;
  currentGoal.progress_percent = progress;
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
    showMessage(
      'Only .txt or Word .docx files are supported for completing a micro-goal.',
      'danger',
    );
    return;
  }

  try {
    const formData = new FormData(form);
    formData.set('user_id', form.dataset.userId);
    await postForm(`${apiBase}/micro-goals/${form.dataset.goalId}/evidence`, formData);
    form.reset();
    showModal(page.completionModal, false);
    await loadSession();
    showMessage('Micro-goal completed. Moving to the next queued micro-goal.', 'info');
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

function openConsultationModal(memberName, memberUserId) {
  pendingConsultationMemberId = Number(memberUserId) || null;
  page.consultationMemberName.textContent = memberName || 'This user';
  showModal(page.consultationModal, true);
}

function handleMemberActivation(event) {
  const button = event.target.closest('.consultation-status-button');
  if (!button) return;

  openConsultationModal(button.dataset.consultationName, button.dataset.consultationUserId);
}

function setConsultationStatus(text, isVisible = true) {
  page.consultationWorkspaceStatus.textContent = text;
  page.consultationWorkspaceStatus.classList.toggle('is-visible', Boolean(isVisible && text));
}

function clampUnit(value) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return 0;
  return Math.min(Math.max(numberValue, 0), 1);
}

function sanitizeWhiteboardStrokes(strokes) {
  if (!Array.isArray(strokes)) return [];

  return strokes
    .map((stroke) => {
      const points = Array.isArray(stroke?.points)
        ? stroke.points
            .map((point) => ({
              x: clampUnit(point?.x),
              y: clampUnit(point?.y),
            }))
            .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
        : [];
      if (!points.length) return null;

      const width = Number(stroke.width);
      return {
        color: /^#[0-9a-f]{6}$/i.test(stroke.color) ? stroke.color : '#111827',
        width: Number.isFinite(width) ? Math.min(Math.max(width, 1), 12) : 3,
        points,
      };
    })
    .filter(Boolean);
}

function hasUnsavedWorkspaceChanges() {
  return workspaceRevision > savedWorkspaceRevision;
}

function markWorkspaceDirty() {
  workspaceRevision += 1;
}

function markWorkspaceClean(revision = workspaceRevision) {
  savedWorkspaceRevision = Math.max(savedWorkspaceRevision, revision);
}

function resetConsultationWorkspaceState() {
  window.clearTimeout(workspaceSaveTimer);
  workspaceSaveTimer = null;
  workspaceSaveInFlight = false;
  workspaceRevision = 0;
  savedWorkspaceRevision = 0;
  lastWorkspaceUpdatedAt = null;
  whiteboardDrawing = false;
  whiteboardStrokes = [];
  whiteboardCurrentStroke = null;
  if (page.consultationScratchpad) page.consultationScratchpad.value = '';
  switchWorkspaceTab('whiteboard');
  resizeWhiteboardCanvas();
}

function switchWorkspaceTab(tabName) {
  activeWorkspaceTab = tabName === 'scratchpad' ? 'scratchpad' : 'whiteboard';

  page.workspaceTabButtons.forEach((button) => {
    const isActive = button.dataset.workspaceTab === activeWorkspaceTab;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });

  page.workspacePanels.forEach((panel) => {
    panel.classList.toggle('d-none', panel.dataset.workspacePanel !== activeWorkspaceTab);
  });

  if (activeWorkspaceTab === 'whiteboard') scheduleWhiteboardResize();
}

function scheduleWhiteboardResize() {
  window.requestAnimationFrame(resizeWhiteboardCanvas);
  window.setTimeout(resizeWhiteboardCanvas, 120);
}

function whiteboardSize() {
  const rect = page.consultationWhiteboard?.getBoundingClientRect();
  return {
    width: Math.max(1, Math.round(rect?.width || 1)),
    height: Math.max(1, Math.round(rect?.height || 1)),
  };
}

function resizeWhiteboardCanvas() {
  const canvas = page.consultationWhiteboard;
  if (!canvas) return;

  const { width, height } = whiteboardSize();
  const pixelRatio = window.devicePixelRatio || 1;
  const nextWidth = Math.max(1, Math.round(width * pixelRatio));
  const nextHeight = Math.max(1, Math.round(height * pixelRatio));

  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth;
    canvas.height = nextHeight;
  }

  whiteboardContext = canvas.getContext('2d');
  whiteboardContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  redrawWhiteboard();
}

function paintWhiteboardBackground() {
  if (!whiteboardContext) return;
  const { width, height } = whiteboardSize();
  whiteboardContext.clearRect(0, 0, width, height);
  whiteboardContext.fillStyle = '#ffffff';
  whiteboardContext.fillRect(0, 0, width, height);
}

function drawWhiteboardStroke(stroke) {
  if (!whiteboardContext || !stroke?.points?.length) return;

  const { width, height } = whiteboardSize();
  whiteboardContext.beginPath();
  whiteboardContext.lineCap = 'round';
  whiteboardContext.lineJoin = 'round';
  whiteboardContext.strokeStyle = stroke.color || '#111827';
  whiteboardContext.lineWidth = Number(stroke.width) || 3;

  stroke.points.forEach((point, index) => {
    const x = clampUnit(point.x) * width;
    const y = clampUnit(point.y) * height;
    if (index === 0) {
      whiteboardContext.moveTo(x, y);
      if (stroke.points.length === 1) whiteboardContext.lineTo(x + 0.1, y + 0.1);
      return;
    }
    whiteboardContext.lineTo(x, y);
  });

  whiteboardContext.stroke();
}

function redrawWhiteboard() {
  if (!whiteboardContext) return;
  paintWhiteboardBackground();
  whiteboardStrokes.forEach(drawWhiteboardStroke);
  drawWhiteboardStroke(whiteboardCurrentStroke);
}

function getWhiteboardPoint(event) {
  const rect = page.consultationWhiteboard.getBoundingClientRect();
  return {
    x: clampUnit((event.clientX - rect.left) / (rect.width || 1)),
    y: clampUnit((event.clientY - rect.top) / (rect.height || 1)),
  };
}

function shouldAddWhiteboardPoint(stroke, point) {
  const previous = stroke.points[stroke.points.length - 1];
  if (!previous) return true;
  const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
  return distance > 0.003;
}

function startWhiteboardStroke(event) {
  if (!activeConsultation || activeConsultation.ended_at) return;

  event.preventDefault();
  resizeWhiteboardCanvas();
  whiteboardDrawing = true;
  whiteboardCurrentStroke = {
    color: '#111827',
    width: 3,
    points: [getWhiteboardPoint(event)],
  };
  page.consultationWhiteboard.setPointerCapture?.(event.pointerId);
  redrawWhiteboard();
}

function moveWhiteboardStroke(event) {
  if (!whiteboardDrawing || !whiteboardCurrentStroke) return;

  event.preventDefault();
  const point = getWhiteboardPoint(event);
  if (!shouldAddWhiteboardPoint(whiteboardCurrentStroke, point)) return;
  whiteboardCurrentStroke.points.push(point);
  redrawWhiteboard();
}

function finishWhiteboardStroke(event) {
  if (!whiteboardDrawing || !whiteboardCurrentStroke) return;

  event?.preventDefault();
  if (event?.clientX !== undefined) {
    const point = getWhiteboardPoint(event);
    if (shouldAddWhiteboardPoint(whiteboardCurrentStroke, point)) {
      whiteboardCurrentStroke.points.push(point);
    }
  }

  whiteboardDrawing = false;
  if (
    event?.pointerId !== undefined &&
    page.consultationWhiteboard.hasPointerCapture?.(event.pointerId)
  ) {
    page.consultationWhiteboard.releasePointerCapture(event.pointerId);
  }
  whiteboardStrokes.push(whiteboardCurrentStroke);
  whiteboardCurrentStroke = null;
  markWorkspaceDirty();
  scheduleConsultationWorkspaceSave();
  redrawWhiteboard();
}

function clearWhiteboard() {
  if (!activeConsultation || activeConsultation.ended_at) return;

  whiteboardStrokes = [];
  whiteboardCurrentStroke = null;
  markWorkspaceDirty();
  scheduleConsultationWorkspaceSave();
  redrawWhiteboard();
}

function applyConsultationWorkspace(workspace) {
  if (workspace?.updated_at && workspace.updated_at === lastWorkspaceUpdatedAt) return;

  lastWorkspaceUpdatedAt = workspace?.updated_at || null;
  whiteboardStrokes = sanitizeWhiteboardStrokes(workspace?.whiteboard_strokes);
  whiteboardCurrentStroke = null;
  if (page.consultationScratchpad) {
    page.consultationScratchpad.value = workspace?.scratchpad_text || '';
  }
  workspaceRevision += 1;
  markWorkspaceClean();
  redrawWhiteboard();
}

async function loadConsultationWorkspace(options = {}) {
  if (!activeConsultation?.id) return;
  if (
    !options.force &&
    (whiteboardDrawing || workspaceSaveInFlight || hasUnsavedWorkspaceChanges())
  ) {
    return;
  }

  try {
    const workspace = await getJson(consultationWorkspaceUrl(activeConsultation.id));
    if (
      !options.force &&
      (whiteboardDrawing || workspaceSaveInFlight || hasUnsavedWorkspaceChanges())
    ) {
      return;
    }
    applyConsultationWorkspace(workspace);
  } catch (error) {
    if (!options.silent) setConsultationStatus(error.message);
  }
}

async function saveConsultationWorkspace(options = {}) {
  if (!activeConsultation?.id) return;
  if (!options.force && !hasUnsavedWorkspaceChanges()) return;
  if (workspaceSaveInFlight) {
    scheduleConsultationWorkspaceSave();
    return;
  }

  const revisionToSave = workspaceRevision;
  workspaceSaveInFlight = true;
  window.clearTimeout(workspaceSaveTimer);
  workspaceSaveTimer = null;

  try {
    const workspace = await getJson(consultationWorkspaceUrl(activeConsultation.id), {
      method: 'PATCH',
      body: JSON.stringify({
        user_id: CURRENT_USER_ID,
        whiteboard_strokes: whiteboardStrokes,
        scratchpad_text: page.consultationScratchpad?.value || '',
      }),
    });

    lastWorkspaceUpdatedAt = workspace.updated_at || lastWorkspaceUpdatedAt;
    markWorkspaceClean(revisionToSave);
    if (hasUnsavedWorkspaceChanges()) scheduleConsultationWorkspaceSave();
  } catch (error) {
    if (!options.silent) setConsultationStatus(error.message);
  } finally {
    workspaceSaveInFlight = false;
  }
}

function scheduleConsultationWorkspaceSave() {
  window.clearTimeout(workspaceSaveTimer);
  workspaceSaveTimer = window.setTimeout(() => {
    saveConsultationWorkspace({ silent: true });
  }, 700);
}

function startConsultationWorkspacePolling() {
  window.clearInterval(workspacePollTimer);
  workspacePollTimer = window.setInterval(() => {
    loadConsultationWorkspace({ silent: true });
  }, 5000);
}

function stopConsultationWorkspacePolling() {
  window.clearInterval(workspacePollTimer);
  workspacePollTimer = null;
}

function renderConsultationContext() {
  if (!activeConsultation) return;

  page.consultationWorkspaceTitle.textContent = activeConsultation.topic || 'Study consultation';
  page.consultationContext.innerHTML = `
    <div class="consultation-context-card">
      <span>Student</span>
      <strong>${escapeHtml(activeConsultation.student_name || 'Student')}</strong>
    </div>
    <div class="consultation-context-card consultation-context-card-wide">
      <span>Question</span>
      <p>${escapeHtml(activeConsultation.question_text || 'No question captured.')}</p>
    </div>
  `;
}

function renderConsultationWorkspace() {
  if (!activeConsultation) return;

  const isCompleted =
    activeConsultation.status === 'completed' || Boolean(activeConsultation.ended_at);

  renderConsultationContext();
  setConsultationStatus('', false);
  const finishButton = byId('finishConsultationButton');
  finishButton.disabled = isCompleted;
  finishButton.textContent = isCompleted ? 'Ended' : 'End Consultation';
}

function openConsultationWorkspace(consultation) {
  activeConsultation = consultation;
  resetConsultationWorkspaceState();
  renderConsultationWorkspace();
  showModal(page.consultationWorkspaceModal, true);
  window.requestAnimationFrame(() => {
    scheduleWhiteboardResize();
    loadConsultationWorkspace({ force: true, silent: true });
    startConsultationWorkspacePolling();
  });
  updateRejoinButton();
}

function closeConsultationWorkspace() {
  saveConsultationWorkspace({ silent: true });
  stopConsultationWorkspacePolling();
  showModal(page.consultationWorkspaceModal, false);
  updateRejoinButton();
}

function openConsultationReviewModal(consultation = activeConsultation) {
  if (!consultation) return;

  activeConsultation = consultation;
  const studentName = consultation.student_name || 'the student';
  page.consultationReviewPrompt.textContent = `Send ${studentName} a concise direction or next step.`;
  page.consultationReviewForm.elements.teacher_direction.value =
    consultation.teacher_direction || '';
  const selectedChecklist = new Set(consultation.reflection?.summary_checklist || []);
  page.consultationReviewForm
    .querySelectorAll('input[name="summary_checklist"]')
    .forEach((item) => {
      item.checked = selectedChecklist.has(item.value);
    });
  showModal(page.consultationReviewModal, true);
  page.consultationReviewForm.elements.teacher_direction.focus();
}

function openConsultationDirectionModal(consultation = activeConsultation) {
  if (!consultation?.teacher_direction) return;

  activeConsultation = consultation;
  page.consultationDirectionText.textContent = consultation.teacher_direction;
  showModal(page.consultationDirectionModal, true);
}

function showConsultationEndedToast(consultation) {
  const isTeacher = Number(consultation.teacher_user_id) === CURRENT_USER_ID;

  if (isTeacher) {
    showToast({
      title: 'Consultation ended',
      message: `Add a direction or next step for ${consultation.student_name || 'the student'}.`,
      type: 'info',
      actionLabel: 'Review',
      action: () => openConsultationReviewModal(consultation),
    });
    return;
  }

  showToast({
    title: 'Consultation ended',
    message: 'Both members are focusing again.',
    type: 'success',
  });
}

function showStudentDirectionToast(consultation) {
  if (!consultation?.teacher_direction) return;

  const title =
    Number(consultation.student_user_id) === CURRENT_USER_ID
      ? 'Direction / next step'
      : `${consultation.student_name || 'Student'} receives direction`;

  showToast({
    title,
    message: consultation.teacher_direction,
    type: 'success',
    actionLabel: 'Read only',
    action: () => openConsultationDirectionModal(consultation),
  });
}

async function startConsultation() {
  const memberData = (sessionData.members || []).find(
    (item) => Number(item.user_id) === pendingConsultationMemberId,
  );
  if (!memberData) {
    showMessage('Choose a member who needs help before starting consultation.', 'danger');
    return;
  }

  const button = byId('confirmConsultationButton');
  button.disabled = true;
  button.textContent = 'Starting...';

  try {
    const consultation = await getJson(consultationUrl(), {
      method: 'POST',
      body: JSON.stringify({
        student_user_id: memberData.user_id,
        teacher_user_id: CURRENT_USER_ID,
      }),
    });

    showModal(page.consultationModal, false);
    openConsultationWorkspace(consultation);
    await loadSession();
  } catch (error) {
    showMessage(error.message, 'danger');
  } finally {
    button.disabled = false;
    button.textContent = 'Start Consultation';
  }
}

async function finishConsultation(event) {
  event?.preventDefault();
  if (!activeConsultation || activeConsultation.ended_at) return;

  const payload = {
    submitted_by_user_id: CURRENT_USER_ID,
  };

  const button = byId('finishConsultationButton');
  button.disabled = true;

  try {
    await saveConsultationWorkspace({ force: true, silent: false });
    activeConsultation = await getJson(consultationFinishUrl(activeConsultation.id), {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });

    closeConsultationWorkspace();
    await loadSession();
    showConsultationEndedToast(activeConsultation);
  } catch (error) {
    setConsultationStatus(error.message);
  } finally {
    if (!activeConsultation?.ended_at) button.disabled = false;
  }
}

async function submitConsultationReview(event) {
  event.preventDefault();
  if (!activeConsultation) return;

  const form = event.target;
  const teacherDirection = form.elements.teacher_direction.value.trim();
  if (!teacherDirection) {
    showToast({
      title: 'Direction needed',
      message: 'Add a direction or next step before sending.',
      type: 'danger',
    });
    return;
  }

  const button = byId('submitConsultationReviewButton');
  button.disabled = true;
  const summaryChecklist = Array.from(
    form.querySelectorAll('input[name="summary_checklist"]:checked'),
  ).map((item) => item.value);

  try {
    activeConsultation = await getJson(consultationReviewUrl(activeConsultation.id), {
      method: 'PATCH',
      body: JSON.stringify({
        submitted_by_user_id: CURRENT_USER_ID,
        teacher_direction: teacherDirection,
        summary_checklist: summaryChecklist,
      }),
    });

    showModal(page.consultationReviewModal, false);
    form.reset();
    showStudentDirectionToast(activeConsultation);
  } catch (error) {
    showToast({
      title: 'Review not sent',
      message: error.message,
      type: 'danger',
    });
  } finally {
    button.disabled = false;
  }
}

function openMemberGoalsModal(userId) {
  const memberData = (sessionData.members || []).find(
    (item) => Number(item.user_id) === Number(userId),
  );
  if (!memberData) return;

  const displayName = Number(memberData.user_id) === CURRENT_USER_ID ? 'You' : memberData.name;

  page.memberGoalsModalTitle.textContent = `${displayName || 'Member'}: Micro-goals & Uploads`;
  page.memberGoalsModalContent.innerHTML = renderMemberGoals(memberData);
  page.memberGoalsModalContent
    .querySelectorAll('.work-check-form')
    .forEach((form) => loadWorkCheckHistory(form));
  showModal(page.memberGoalsModal, true);
}

function handleMemberGoalsButton(event) {
  const button = event.target.closest('.member-goals-button');
  if (!button) return;

  openMemberGoalsModal(button.dataset.memberUserId);
}

async function exitSession() {
  try {
    await getJson(`${apiBase}/exit`, { method: 'PATCH' });
  } catch (error) {
    console.info('Could not mark session as exited:', error.message);
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
  page.memberGoalsModal.addEventListener('submit', handleEvidenceFormSubmit);
  page.memberGoalsModal.addEventListener('change', handleWorkCheckChecklistChange);
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
  byId('confirmConsultationButton').addEventListener('click', startConsultation);
  byId('closeConsultationWorkspaceButton').addEventListener('click', closeConsultationWorkspace);
  byId('finishConsultationButton').addEventListener('click', finishConsultation);
  page.workspaceTabButtons.forEach((button) => {
    button.addEventListener('click', () => switchWorkspaceTab(button.dataset.workspaceTab));
  });
  page.consultationWhiteboard.addEventListener('pointerdown', startWhiteboardStroke);
  page.consultationWhiteboard.addEventListener('pointermove', moveWhiteboardStroke);
  page.consultationWhiteboard.addEventListener('pointerup', finishWhiteboardStroke);
  page.consultationWhiteboard.addEventListener('pointercancel', finishWhiteboardStroke);
  page.consultationScratchpad.addEventListener('input', () => {
    markWorkspaceDirty();
    scheduleConsultationWorkspaceSave();
  });
  page.clearWhiteboardButton.addEventListener('click', clearWhiteboard);
  window.addEventListener('resize', () => {
    if (!page.consultationWorkspaceModal.classList.contains('d-none')) {
      resizeWhiteboardCanvas();
    }
  });
  page.rejoinConsultationButton.addEventListener('click', () =>
    openConsultationWorkspace(activeConsultation),
  );
  page.consultationReviewForm.addEventListener('submit', submitConsultationReview);
  byId('cancelConsultationReviewButton').addEventListener('click', () =>
    showModal(page.consultationReviewModal, false),
  );
  byId('closeConsultationReviewButton').addEventListener('click', () =>
    showModal(page.consultationReviewModal, false),
  );
  byId('closeConsultationDirectionButton').addEventListener('click', () =>
    showModal(page.consultationDirectionModal, false),
  );

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
  page.consultationWorkspaceModal.addEventListener('click', (event) => {
    if (event.target === page.consultationWorkspaceModal) {
      closeConsultationWorkspace();
    }
  });
  page.consultationReviewModal.addEventListener('click', (event) => {
    if (event.target === page.consultationReviewModal) {
      showModal(page.consultationReviewModal, false);
    }
  });
  page.consultationDirectionModal.addEventListener('click', (event) => {
    if (event.target === page.consultationDirectionModal) {
      showModal(page.consultationDirectionModal, false);
    }
  });
  page.memberGoalsModal.addEventListener('click', (event) => {
    if (event.target === page.memberGoalsModal) showModal(page.memberGoalsModal, false);
  });
  page.completionModal.addEventListener('click', (event) => {
    if (event.target === page.completionModal) showModal(page.completionModal, false);
  });

  loadSession();
});
