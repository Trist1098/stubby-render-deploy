// Timer, status, and session-state calculation helpers.
function normalizeStatusForApi(status) {
  const normalized = String(status || 'focus')
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (normalized === 'focusing') return 'focus';
  if (normalized === 'on_break') return 'break';
  return normalized;
}

function statusClassForApiStatus(status) {
  const normalizedStatus = normalizeStatusForApi(status);
  return normalizedStatus === 'break' ? 'on-break' : normalizedStatus.replace(/_/g, '-');
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

function isSessionExpired() {
  return sessionData.status === 'expired';
}

function isCurrentMemberTimerPaused() {
  return Boolean(getCurrentMember()?.is_timer_paused);
}

function timersPausedForViewer() {
  return isSessionExpired() || isCurrentMemberTimerPaused() || sessionData.status === 'completed';
}

function sessionMemberForViewer(data = sessionData) {
  return (data.members || []).find((memberData) => Number(memberData.user_id) === CURRENT_USER_ID);
}

function sessionTimersPausedForViewer(data = sessionData) {
  const currentMember = sessionMemberForViewer(data);
  return (
    data.status === 'expired' ||
    data.status === 'completed' ||
    Boolean(currentMember?.is_timer_paused)
  );
}

function remainingSecondsForSession(data = sessionData, anchorStartedAt = timerStartedAt) {
  const elapsedSeconds = sessionTimersPausedForViewer(data)
    ? 0
    : Math.floor((Date.now() - anchorStartedAt) / 1000);
  return Math.max(0, Number(data.remaining_seconds || 0) - elapsedSeconds);
}

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

function memberStatusKey(memberData) {
  return normalizeStatusForApi(memberData?.status_class || memberData?.current_status);
}

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

function updatePausedRemainingSeconds() {
  if (timersPausedForViewer()) {
    if (pausedRemainingSeconds === null) {
      pausedRemainingSeconds = Math.max(0, Number(sessionData.remaining_seconds) || 0);
    }
    return;
  }

  pausedRemainingSeconds = null;
}
