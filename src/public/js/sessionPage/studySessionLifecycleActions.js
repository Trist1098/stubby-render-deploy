// Session loading, lifecycle, expiry, and mission actions.
// Ask the backend for the latest state after the local timer reaches zero.
async function refreshExpiredSessionState() {
  if (expiryRefreshInFlight) return;

  expiryRefreshInFlight = true;
  try {
    await loadSession({ silent: true, promptForMission: false });
  } finally {
    expiryRefreshInFlight = false;
  }
}

// Load the session payload and redraw the page, preserving smooth timers during silent polls.
async function loadSession(options = {}) {
  if (!options.force && (activeProgressDrag || progressUpdateInFlight)) return;
  if (sessionLoadInFlight) return;
  sessionLoadInFlight = true;
  if (!options.silent) clearMessage();
  syncRenderedStatusTimers();

  const previousSessionData = sessionData;
  const previousRemainingSeconds = remainingSecondsForSession(previousSessionData);
  let nextSessionData;

  try {
    nextSessionData = await getJson(apiBase);
  } catch (error) {
    if (!options.silent) {
      showMessage(error.message || 'Could not load the live study session.', 'danger');
    }
    sessionLoadInFlight = false;
    return;
  }

  if (shouldPreserveCountdown(previousSessionData, nextSessionData, options)) {
    const serverRemainingSeconds = Number(nextSessionData.remaining_seconds || 0);
    nextSessionData.remaining_seconds = Math.min(previousRemainingSeconds, serverRemainingSeconds);
  }

  preserveMemberStatusTimers(previousSessionData, nextSessionData, options);
  sessionData = nextSessionData;
  timerStartedAt = Date.now();
  localStorage.setItem('currentStudySessionId', String(sessionId));
  renderPage();
  if (options.promptForMission !== false) promptForSessionIntention();
  if (options.refreshStatusMix !== false) loadFocusStatusMix({ showLoading: !options.silent });
  sessionLoadInFlight = false;
}

// Show the right time-expiry choice: extend globally, or stay after someone else extended.
function renderTimeExpiryModal() {
  if (!page.timeExpiryModal) return;

  const showExtendChoice = isSessionExpired();
  const showStayChoice = !showExtendChoice && isCurrentMemberTimerPaused();

  if (!showExtendChoice && !showStayChoice) {
    showModal(page.timeExpiryModal, false);
    return;
  }

  page.extendSessionForm.classList.toggle('d-none', !showExtendChoice);
  page.stayExitPanel.classList.toggle('d-none', !showStayChoice);

  if (showExtendChoice) {
    page.timeExpiryTitle.textContent = 'Time is up';
    page.timeExpiryText.textContent =
      'All study timers are paused. End the session or extend the timer to keep working.';
  } else {
    page.timeExpiryTitle.textContent = 'Session extended';
    page.timeExpiryText.textContent =
      'Another member extended the session. Your timers are still paused until you stay or exit.';
  }

  showModal(page.timeExpiryModal, true);
}

// Scope the mission/intention draft to this session and this user.
function sessionIntentionKey() {
  return INTENTION_STORAGE_PREFIX + sessionId + ':' + CURRENT_USER_ID;
}

// Prefer the local mission, then hydrate it from the current member payload if available.
function readSessionIntention() {
  const localIntention = localStorage.getItem(sessionIntentionKey()) || '';
  if (localIntention) return localIntention;

  const memberMission = sessionMemberForViewer()?.session_mission || '';
  if (memberMission) localStorage.setItem(sessionIntentionKey(), memberMission);
  return memberMission;
}

// Update the mission strip shown at the top of the focus card.
function renderSessionIntention() {
  const intention = readSessionIntention();
  page.missionStrip.classList.toggle('d-none', !intention);
  page.missionText.textContent = intention;
}

// Open the mission editor with the latest known intention filled in.
function openIntentionModal() {
  page.intentionInput.value = readSessionIntention();
  showModal(page.intentionModal, true);
  window.setTimeout(() => page.intentionInput.focus(), 0);
}

// Ask for a mission once so the session starts with a clear target.
function promptForSessionIntention() {
  renderSessionIntention();
  if (!readSessionIntention()) openIntentionModal();
}

// Try to sync the mission to the backend, but keep the local copy if sync fails.
async function saveMissionToServer(mission) {
  try {
    const member = await getJson(apiBase + '/members/mission', {
      method: 'PATCH',
      body: JSON.stringify({ mission }),
    });

    const currentMember = getCurrentMember();
    if (currentMember) currentMember.session_mission = member.mission || mission;
  } catch (error) {
    showToast({
      title: 'Mission saved locally',
      message: 'It will stay on this browser, but could not sync to the session yet.',
      type: 'danger',
    });
  }
}

// Save the session mission from the modal.
async function saveSessionIntention(event) {
  event.preventDefault();

  const intention = page.intentionInput.value.trim();
  if (!intention) {
    page.intentionInput.focus();
    return;
  }

  localStorage.setItem(sessionIntentionKey(), intention);
  const currentMember = getCurrentMember();
  if (currentMember) currentMember.session_mission = intention;
  showModal(page.intentionModal, false);
  renderSessionIntention();
  await saveMissionToServer(intention);
}

// Check whether the current viewer is already marked as in consultation.
function isCurrentUserInConsultation() {
  const currentMember = getCurrentMember();
  return (
    normalizeStatusForApi(currentMember?.status_class || currentMember?.current_status) ===
    'in_consultation'
  );
}

// Show the rejoin button only when there is an active consultation to return to.
function updateRejoinButton() {
  if (!page.rejoinConsultationButton) return;

  const shouldShow =
    activeConsultation &&
    !activeConsultation.ended_at &&
    isCurrentUserInConsultation() &&
    page.consultationWorkspaceModal?.classList.contains('d-none');

  page.rejoinConsultationButton.classList.toggle('d-none', !shouldShow);
}

// Tell the backend the member exited, then leave the session page.
async function exitSession() {
  try {
    await getJson(`${apiBase}/exit`, { method: 'PATCH' });
  } catch (error) {
    console.info('Could not mark session as exited:', error.message);
  }

  window.location.href = 'index.html';
}

// Extend an expired session and restart the local timers.
async function extendExpiredSession(event) {
  event.preventDefault();

  const extensionSeconds = Number(page.extendMinutesSelect.value) || 600;
  const submitButton = page.extendSessionForm.querySelector('button[type="submit"]');
  setButtonsDisabled([submitButton, page.endExpiredSessionButton], true);

  try {
    await getJson(`${apiBase}/time-expiry/extend`, {
      method: 'PATCH',
      body: JSON.stringify({
        user_id: CURRENT_USER_ID,
        extension_seconds: extensionSeconds,
      }),
    });
    pausedRemainingSeconds = null;
    showModal(page.timeExpiryModal, false);
    await loadSession({ silent: true, promptForMission: false });
    await loadFocusStatusMix({ showLoading: false });
    showMessage(`Session extended by ${Math.round(extensionSeconds / 60)} minutes.`, 'info');
  } catch (error) {
    showMessage(error.message, 'danger');
  } finally {
    setButtonsDisabled([submitButton, page.endExpiredSessionButton], false);
  }
}

// Let this viewer continue after another member has extended the session.
async function stayInExtendedSession() {
  setButtonsDisabled([page.stayExtendedSessionButton, page.exitExtendedSessionButton], true);

  try {
    await getJson(`${apiBase}/time-expiry/stay`, {
      method: 'PATCH',
      body: JSON.stringify({ user_id: CURRENT_USER_ID }),
    });
    pausedRemainingSeconds = null;
    showModal(page.timeExpiryModal, false);
    await loadSession({ silent: true, promptForMission: false });
    await loadFocusStatusMix({ showLoading: false });
  } catch (error) {
    showMessage(error.message, 'danger');
  } finally {
    setButtonsDisabled([page.stayExtendedSessionButton, page.exitExtendedSessionButton], false);
  }
}

// Leave after an extension while the rest of the session can keep going.
async function leaveExtendedSession() {
  setButtonsDisabled([page.exitExtendedSessionButton, page.stayExtendedSessionButton], true);

  try {
    await getJson(`${apiBase}/time-expiry/leave`, {
      method: 'PATCH',
      body: JSON.stringify({ user_id: CURRENT_USER_ID }),
    });
  } catch (error) {
    console.info('Could not mark member as left:', error.message);
  }

  window.location.href = 'index.html';
}
