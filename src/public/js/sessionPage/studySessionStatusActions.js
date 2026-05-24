// Status-change actions for the current member.
function applyOptimisticCurrentStatus(status) {
  const normalizedStatus = normalizeStatusForApi(status);
  const currentMember = getCurrentMember();

  if (currentMember) {
    const previousStatus = normalizeStatusForApi(
      currentMember.status_class || currentMember.current_status,
    );
    currentMember.current_status = focusStatusMeta(normalizedStatus).label;
    currentMember.status_class = statusClassForApiStatus(normalizedStatus);
    currentMember.is_timer_paused = false;
    if (previousStatus !== normalizedStatus) currentMember.status_timer = 0;
  }

  updateStatusMixMemberStatus(CURRENT_USER_ID, normalizedStatus);
  refreshFocusStatusMixDom();
  if (currentMember) renderMemberCardInPlace(currentMember);
  renderStatusControls();
}

async function flushStatusUpdateQueue() {
  if (statusUpdateInFlight) return;

  statusUpdateInFlight = true;
  try {
    while (pendingStatusUpdate) {
      const statusToSend = pendingStatusUpdate;
      pendingStatusUpdate = null;

      try {
        const updatedMember = await getJson(`${apiBase}/members/status`, {
          method: 'PATCH',
          body: JSON.stringify({
            user_id: CURRENT_USER_ID,
            status: statusToSend,
          }),
        });

        if (!pendingStatusUpdate) {
          const currentMember = getCurrentMember();
          if (currentMember) {
            currentMember.current_status = updatedMember.current_status;
            currentMember.status_class = updatedMember.status_class;
            currentMember.status_timer = updatedMember.status_timer || 0;
            renderMemberCardInPlace(currentMember);
            renderStatusControls();
          }
        }
      } catch (error) {
        if (!pendingStatusUpdate) showMessage(error.message, 'danger');
      }
    }
  } finally {
    statusUpdateInFlight = false;
  }

  loadFocusStatusMix({ showLoading: false });
}

function updateCurrentStatus(event) {
  const button = event.currentTarget;
  const rawStatus = button.dataset.status;
  if (!rawStatus) return;
  if (timersPausedForViewer()) {
    showMessage('Choose how to continue before changing status.', 'info');
    renderTimeExpiryModal();
    return;
  }
  const status = normalizeStatusForApi(rawStatus);

  syncRenderedStatusTimers();
  focusStatusMixRequestVersion += 1;
  applyOptimisticCurrentStatus(status);
  pendingStatusUpdate = status;
  flushStatusUpdateQueue();
}
