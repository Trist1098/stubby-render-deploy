async function refreshExpiredSessionState() {
  if (expiryRefreshInFlight) return;

  expiryRefreshInFlight = true;
  try {
    await loadSession({ silent: true, promptForMission: false });
  } finally {
    expiryRefreshInFlight = false;
  }
}

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

function sessionIntentionKey() {
  return INTENTION_STORAGE_PREFIX + sessionId + ':' + CURRENT_USER_ID;
}

function readSessionIntention() {
  const localIntention = localStorage.getItem(sessionIntentionKey()) || '';
  if (localIntention) return localIntention;

  const memberMission = sessionMemberForViewer()?.session_mission || '';
  if (memberMission) localStorage.setItem(sessionIntentionKey(), memberMission);
  return memberMission;
}

function renderSessionIntention() {
  const intention = readSessionIntention();
  page.missionStrip.classList.toggle('d-none', !intention);
  page.missionText.textContent = intention;
}

function openIntentionModal() {
  page.intentionInput.value = readSessionIntention();
  showModal(page.intentionModal, true);
  window.setTimeout(() => page.intentionInput.focus(), 0);
}

function promptForSessionIntention() {
  renderSessionIntention();
  if (!readSessionIntention()) openIntentionModal();
}

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

async function exitSession() {
  try {
    await getJson(`${apiBase}/exit`, { method: 'PATCH' });
  } catch (error) {
    console.info('Could not mark session as exited:', error.message);
  }

  window.location.href = '/home';
}

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

  window.location.href = '/home';
}
