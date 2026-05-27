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
