// Top-level study-session render orchestration.
// Redraw every visible part of the live session after the main session payload changes.
function renderPage() {
  page.title.textContent = sessionData.title || 'Software Engineering Practice';
  updatePausedRemainingSeconds();
  renderCurrentGoal();
  renderMembers();
  renderStatusControls();
  renderStatusProgress();
  updateRejoinButton();
  renderTimeExpiryModal();
  startTimer();
  startStatusTimer();
  startSessionPolling();
  startFocusStatusPolling();
}
