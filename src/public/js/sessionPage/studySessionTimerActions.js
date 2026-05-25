// Timer and polling actions for the study-session page.
// Start or restart the main countdown tick.
function startTimer() {
  clearInterval(timerInterval);
  renderTimer();
  timerInterval = setInterval(renderTimer, 1000);
}

// Start or restart the member status and analytics timer tick.
function startStatusTimer() {
  clearInterval(statusTimerInterval);
  renderStatusTimers();
  renderFocusStatusTrackedTimers();
  statusTimerInterval = setInterval(() => {
    renderStatusTimers();
    renderFocusStatusTrackedTimers();
  }, 1000);
}

// Poll the full session payload in the background.
function startSessionPolling() {
  clearInterval(sessionPollInterval);
  sessionPollInterval = setInterval(() => {
    loadSession({ silent: true, promptForMission: false, refreshStatusMix: false });
  }, SESSION_REFRESH_INTERVAL_MS);
}

// Poll the focus/status mix more often so the analytics panel feels live.
function startFocusStatusPolling() {
  clearInterval(focusStatusMixPollInterval);
  focusStatusMixPollInterval = setInterval(() => {
    loadFocusStatusMix({ showLoading: false });
  }, FOCUS_STATUS_MIX_REFRESH_INTERVAL_MS);
}

// Render the countdown ring and ask the backend to confirm expiry when time runs out.
function renderTimer() {
  const remainingSeconds =
    pausedRemainingSeconds !== null
      ? Math.max(0, pausedRemainingSeconds)
      : remainingSecondsForSession();
  const totalSeconds = Math.max(
    remainingSeconds,
    Number(sessionData.planned_duration_seconds || 0),
  );

  page.timer.textContent = timerText(remainingSeconds);
  page.timer.parentElement.style.setProperty(
    '--timer-progress',
    totalSeconds ? `${(remainingSeconds / totalSeconds) * 100}%` : '0%',
  );

  if (
    remainingSeconds <= 0 &&
    sessionData.status === 'active' &&
    Number(sessionData.planned_duration_seconds || 0) > 0
  ) {
    refreshExpiredSessionState();
  }
}
