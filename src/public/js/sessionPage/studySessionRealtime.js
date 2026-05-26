const realtimeState = {
  socket: null,
  joined: false,
};

function refreshSessionFromRealtime(options = {}) {
  loadSession({
    silent: true,
    promptForMission: false,
    force: true,
    ...options,
  });
  loadFocusStatusMix({ showLoading: false });
}

function applyRealtimeMemberStatus(member) {
  if (!member?.user_id) return;

  const localMember = (sessionData.members || []).find(
    (item) => Number(item.user_id) === Number(member.user_id),
  );
  if (!localMember) {
    refreshSessionFromRealtime();
    return;
  }

  localMember.current_status = member.current_status;
  localMember.status_class = member.status_class;
  localMember.status_timer = Number(member.status_timer) || 0;
  localMember.is_timer_paused = Boolean(member.is_timer_paused);
  if (member.progress !== undefined) localMember.progress_percent = asPercent(member.progress);

  updateStatusMixMemberStatus(member.user_id, member.status_class || member.current_status);
  refreshFocusStatusMixDom();
  renderMemberCardInPlace(localMember);
  if (Number(member.user_id) === CURRENT_USER_ID) renderStatusControls();
}

function applyRealtimeProgressUpdate(payload = {}) {
  const userId = Number(payload.userId);
  const progress = asPercent(payload.progressPercent);
  const member = (sessionData.members || []).find((item) => Number(item.user_id) === userId);

  if (!member) {
    refreshSessionFromRealtime({ refreshStatusMix: false });
    return;
  }

  member.progress_percent = progress;
  const currentGoalId = Number(sessionData.micro_goal?.id);
  const changedGoalId = Number(payload.microGoalId);
  const memberGoal = (member.goals || []).find((goal) => Number(goal.id) === changedGoalId);

  if (memberGoal) memberGoal.progress_percent = progress;
  if (currentGoalId === changedGoalId && Number(member.user_id) === CURRENT_USER_ID) {
    const currentGoal = getCurrentMemberGoal();
    if (currentGoal) currentGoal.progress_percent = progress;
    renderStatusProgress();
  }

  renderMemberCardInPlace(member);
}

function isRealtimeFromCurrentUser(payload = {}) {
  return Number(payload.actorUserId) === CURRENT_USER_ID;
}

function handleRealtimeDiscussionUpdate() {
  if (typeof loadDiscussions === 'function') loadDiscussions({ silent: true });
}

function isCurrentUserInConsultationPayload(consultation) {
  return (
    Number(consultation?.student_user_id) === CURRENT_USER_ID ||
    Number(consultation?.teacher_user_id) === CURRENT_USER_ID
  );
}

function handleRealtimeConsultationStarted(payload = {}) {
  refreshSessionFromRealtime();
  const consultation = payload.consultation;

  if (
    !consultation ||
    isRealtimeFromCurrentUser(payload) ||
    !isCurrentUserInConsultationPayload(consultation)
  ) {
    return;
  }

  activeConsultation = consultation;
  showToast({
    title: 'Consultation started',
    message: `${consultation.teacher_name || 'A member'} started a consultation.`,
    type: 'info',
    actionLabel: 'Open',
    action: () => openConsultationWorkspace(consultation),
  });
  updateRejoinButton();
}

function handleRealtimeConsultationFinished(payload = {}) {
  refreshSessionFromRealtime();
  const consultation = payload.consultation;
  if (!consultation) return;

  if (activeConsultation?.id === consultation.id) {
    activeConsultation = consultation;
    if (!page.consultationWorkspaceModal?.classList.contains('d-none')) {
      renderConsultationWorkspace();
    }
  }

  if (!isRealtimeFromCurrentUser(payload) && isCurrentUserInConsultationPayload(consultation)) {
    showConsultationEndedToast(consultation);
  }
}

function handleRealtimeConsultationReviewed(payload = {}) {
  refreshSessionFromRealtime();
  const consultation = payload.consultation;
  if (!consultation) return;

  if (activeConsultation?.id === consultation.id) activeConsultation = consultation;
  if (!isRealtimeFromCurrentUser(payload) && isCurrentUserInConsultationPayload(consultation)) {
    showStudentDirectionToast(consultation);
  }
}

function handleRealtimeWorkspaceUpdated(payload = {}) {
  if (isRealtimeFromCurrentUser(payload)) return;
  if (Number(activeConsultation?.id) !== Number(payload.consultationId)) return;
  if (whiteboardDrawing || workspaceSaveInFlight || hasUnsavedWorkspaceChanges()) return;
  if (page.consultationWorkspaceModal?.classList.contains('d-none')) return;

  applyConsultationWorkspace(payload.workspace);
}

function startStudySessionRealtime() {
  if (realtimeState.socket || !window.io || !window.auth?.isLoggedIn()) return;

  const token = window.auth.getToken();
  if (!token) return;

  const socket = window.io({ auth: { token } });
  realtimeState.socket = socket;

  socket.on('connect', () => {
    realtimeState.joined = false;
    socket.emit('study-session:join', { sessionId });
  });

  socket.on('study-session:joined', () => {
    realtimeState.joined = true;
  });

  socket.on('study-session:member-status-updated', ({ member }) => {
    applyRealtimeMemberStatus(member);
    loadFocusStatusMix({ showLoading: false });
  });

  socket.on('study-session:progress-updated', applyRealtimeProgressUpdate);
  socket.on('study-session:discussion-updated', handleRealtimeDiscussionUpdate);
  socket.on('study-session:consultation-started', handleRealtimeConsultationStarted);
  socket.on('study-session:consultation-finished', handleRealtimeConsultationFinished);
  socket.on('study-session:consultation-reviewed', handleRealtimeConsultationReviewed);
  socket.on('study-session:workspace-updated', handleRealtimeWorkspaceUpdated);
  socket.on('study-session:refresh-needed', () => refreshSessionFromRealtime());
  socket.on('study-session:time-updated', () => refreshSessionFromRealtime());

  socket.on('disconnect', () => {
    realtimeState.joined = false;
  });
}
