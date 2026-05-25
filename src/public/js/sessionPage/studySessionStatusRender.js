// Rendering for member status controls, status timers, and progress UI.
// Highlight the current status button and disable choices while timers are paused.
function renderStatusControls() {
  const currentMember = getCurrentMember();
  const currentStatus = normalizeStatusForApi(
    currentMember?.status_class || currentMember?.current_status,
  );

  page.statusControls.forEach((button) => {
    const isActive = button.dataset.status === currentStatus;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
    button.disabled = timersPausedForViewer();
  });
}

// Paint the current user's progress bar and explain why it may be locked.
function renderStatusProgress() {
  const currentMember = getCurrentMember();
  const currentGoal = getCurrentMemberGoal();
  const progress = asPercent(currentMember?.progress_percent);
  const isLocked = Boolean(currentGoal?.is_completed || progress >= 100 || timersPausedForViewer());

  paintProgress(progress);
  page.statusProgressBar.classList.toggle('is-locked', isLocked);
  page.statusProgressBar.setAttribute('aria-disabled', String(isLocked));
  page.statusProgressHint.textContent = timersPausedForViewer()
    ? 'Session timers are paused until you choose how to continue.'
    : isLocked
    ? 'Progress is locked at 100% for this micro-goal.'
    : 'Drag or click the bar to update progress. 100% requires workings, a .txt file, or a Word .docx file.';
}

// Refresh every member's visible status timer.
function renderStatusTimers() {
  document.querySelectorAll('.member-status-time').forEach((timer) => {
    timer.textContent = `${statusTime(currentStatusSeconds(timer))} in status`;
  });
}

// Calculate one member timer from its base seconds and render timestamp.
function currentStatusSeconds(timer) {
  const baseSeconds = Number(timer.dataset.statusSeconds) || 0;
  if (timersPausedForViewer() || timer.dataset.timerPaused === 'true') return baseSeconds;

  const renderedAt = Number(timer.dataset.statusRenderedAt) || Date.now();
  const elapsedSeconds = Math.floor((Date.now() - renderedAt) / 1000);
  return baseSeconds + elapsedSeconds;
}

// Copy rendered timers back into sessionData before a refresh or optimistic update.
function syncRenderedStatusTimers() {
  document.querySelectorAll('.session-member-card').forEach((card) => {
    const timer = card.querySelector('.member-status-time');
    const member = (sessionData.members || []).find(
      (item) => Number(item.user_id) === Number(card.dataset.memberUserId),
    );
    if (timer && member) member.status_timer = currentStatusSeconds(timer);
  });
}

// Paint the slider and the current member card with the same progress value.
function paintProgress(progress) {
  page.statusProgressText.textContent = `${progress}%`;
  page.statusProgressFill.style.width = `${progress}%`;
  page.statusProgressBar.style.setProperty('--status-progress', `${progress}%`);
  page.statusProgressBar.setAttribute('aria-valuenow', String(progress));
  page.statusProgressBar.setAttribute('aria-valuetext', `${progress}%`);

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
