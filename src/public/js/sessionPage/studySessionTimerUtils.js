// Timer, status, and session-state calculation helpers.
// Convert all UI status labels into the backend's status keys.
function normalizeStatusForApi(status) {
  const normalized = String(status || 'focus')
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (normalized === 'focusing') return 'focus';
  if (normalized === 'on_break') return 'break';
  return normalized;
}

// Convert API status keys into CSS class names used by the member cards.
function statusClassForApiStatus(status) {
  const normalizedStatus = normalizeStatusForApi(status);
  return normalizedStatus === 'break' ? 'on-break' : normalizedStatus.replace(/_/g, '-');
}

// Format the main countdown timer as mm:ss.
function timerText(seconds) {

  const safeSeconds = Math.max(0, Math.floor(seconds));

  const minutes = Math.floor(safeSeconds / 60);

  const remainder = safeSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;

}

// Format member status timers without forcing a leading zero on minutes.
function statusTime(seconds) {

  const safeSeconds = Math.max(0, Number(seconds) || 0);

  const minutes = Math.floor(safeSeconds / 60);

  const remainder = safeSeconds % 60;

  return `${minutes}:${String(remainder).padStart(2, '0')}`;

}

// Check the session's global expired state.
function isSessionExpired() {
  return sessionData.status === 'expired';
}

// Check whether this viewer personally paused after an extension.
function isCurrentMemberTimerPaused() {
  return Boolean(getCurrentMember()?.is_timer_paused);
}

// Treat completed, expired, and personally paused sessions as timer-paused for this viewer.
function timersPausedForViewer() {
  return isSessionExpired() || isCurrentMemberTimerPaused() || sessionData.status === 'completed';
}

// Find the logged-in member record inside a session payload.
function sessionMemberForViewer(data = sessionData) {
  return (data.members || []).find((memberData) => Number(memberData.user_id) === CURRENT_USER_ID);
}

// Use a supplied payload to decide whether timers should keep ticking for the viewer.
function sessionTimersPausedForViewer(data = sessionData) {
  const currentMember = sessionMemberForViewer(data);
  return (
    data.status === 'expired' ||
    data.status === 'completed' ||
    Boolean(currentMember?.is_timer_paused)
  );
}

// Calculate countdown remaining from the last server value plus local elapsed time.
function remainingSecondsForSession(data = sessionData, anchorStartedAt = timerStartedAt) {
  const elapsedSeconds = sessionTimersPausedForViewer(data)
    ? 0
    : Math.floor((Date.now() - anchorStartedAt) / 1000);
  return Math.max(0, Number(data.remaining_seconds || 0) - elapsedSeconds);
}

// During silent polls, preserve a smooth countdown when the session identity has not changed.
function shouldPreserveCountdown(previousData, nextData, options = {}) {
  if (!options.silent) return false;
  if (!previousData?.id || previousData.id !== nextData?.id) return false;
  if (previousData.status !== nextData.status) return false;
  if (sessionTimersPausedForViewer(previousData) || sessionTimersPausedForViewer(nextData)) {
    return false;
  }

  return (
    Number(previousData.planned_duration_seconds || 0) ===
    Number(nextData.planned_duration_seconds || 0)
  );
}

// Normalize whichever status field the member payload currently has.
function memberStatusKey(memberData) {
  return normalizeStatusForApi(memberData?.status_class || memberData?.current_status);
}

// Keep member status timers from jumping backward during background refreshes.
function preserveMemberStatusTimers(previousData, nextData, options = {}) {
  if (!options.silent || !previousData?.id || previousData.id !== nextData?.id) return;

  const previousMembersByUser = new Map(
    (previousData.members || []).map((memberData) => [Number(memberData.user_id), memberData]),
  );

  (nextData.members || []).forEach((nextMember) => {
    const previousMember = previousMembersByUser.get(Number(nextMember.user_id));
    if (!previousMember) return;

    const sameStatus = memberStatusKey(previousMember) === memberStatusKey(nextMember);
    const samePauseState =
      Boolean(previousMember.is_timer_paused) === Boolean(nextMember.is_timer_paused);
    if (!sameStatus || !samePauseState) return;

    nextMember.status_timer = Math.max(
      Number(nextMember.status_timer) || 0,
      Number(previousMember.status_timer) || 0,
    );
  });
}

// Remember the frozen countdown value while this viewer is paused.
function updatePausedRemainingSeconds() {
  if (timersPausedForViewer()) {
    if (pausedRemainingSeconds === null) {
      pausedRemainingSeconds = Math.max(0, Number(sessionData.remaining_seconds) || 0);
    }
    return;
  }

  pausedRemainingSeconds = null;
}
