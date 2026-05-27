const liveWireState = {
  socket: null,
  joined: false,
};

function refreshFromLiveWire(options = {}) {
  loadSession({
    silent: true,
    promptForMission: false,
    force: true,
    ...options,
  });
  loadFocusStatusMix({ showLoading: false });
}

function applyLiveWireStatus(member) {
  if (!member?.user_id) return;

  const localMember = (sessionData.members || []).find(
    (item) => Number(item.user_id) === Number(member.user_id),
  );
  if (!localMember) {
    refreshFromLiveWire();
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

function applyLiveWireProgress(progressNotice = {}) {
  const userId = Number(progressNotice.userId);
  const progress = asPercent(progressNotice.progressPercent);
  const member = (sessionData.members || []).find((item) => Number(item.user_id) === userId);

  if (!member) {
    refreshFromLiveWire({ refreshStatusMix: false });
    return;
  }

  member.progress_percent = progress;
  const currentGoalId = Number(sessionData.micro_goal?.id);
  const changedGoalId = Number(progressNotice.microGoalId);
  const memberGoal = (member.goals || []).find((goal) => Number(goal.id) === changedGoalId);

  if (memberGoal) memberGoal.progress_percent = progress;
  if (currentGoalId === changedGoalId && Number(member.user_id) === CURRENT_USER_ID) {
    const currentGoal = getCurrentMemberGoal();
    if (currentGoal) currentGoal.progress_percent = progress;
    renderStatusProgress();
  }

  renderMemberCardInPlace(member);
}

function isOwnLiveWireEvent(notice = {}) {
  return Number(notice.actorUserId) === CURRENT_USER_ID;
}

function handleLiveWireDiscussion() {
  if (typeof loadDiscussions === 'function') loadDiscussions({ silent: true });
}

function isCurrentUserInConsultationPayload(consultation) {
  return (
    Number(consultation?.student_user_id) === CURRENT_USER_ID ||
    Number(consultation?.teacher_user_id) === CURRENT_USER_ID
  );
}

function handleLiveWireConsultationStarted(consultationNotice = {}) {
  refreshFromLiveWire();
  const consultation = consultationNotice.consultation;

  if (
    !consultation ||
    isOwnLiveWireEvent(consultationNotice) ||
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

function handleLiveWireConsultationFinished(consultationNotice = {}) {
  refreshFromLiveWire();
  const consultation = consultationNotice.consultation;
  if (!consultation) return;

  if (activeConsultation?.id === consultation.id) {
    activeConsultation = consultation;
    if (!page.consultationWorkspaceModal?.classList.contains('d-none')) {
      renderConsultationWorkspace();
    }
  }

  if (!isOwnLiveWireEvent(consultationNotice) && isCurrentUserInConsultationPayload(consultation)) {
    showConsultationEndedToast(consultation);
  }
}

function handleLiveWireConsultationReviewed(consultationNotice = {}) {
  refreshFromLiveWire();
  const consultation = consultationNotice.consultation;
  if (!consultation) return;

  if (activeConsultation?.id === consultation.id) activeConsultation = consultation;
  if (!isOwnLiveWireEvent(consultationNotice) && isCurrentUserInConsultationPayload(consultation)) {
    showStudentDirectionToast(consultation);
  }
}

function handleLiveWireWorkspace(workspaceNotice = {}) {
  if (isOwnLiveWireEvent(workspaceNotice)) return;
  if (Number(activeConsultation?.id) !== Number(workspaceNotice.consultationId)) return;
  if (whiteboardDrawing || workspaceSaveInFlight || hasUnsavedWorkspaceChanges()) return;
  if (page.consultationWorkspaceModal?.classList.contains('d-none')) return;

  applyConsultationWorkspace(workspaceNotice.workspace);
}

function startStudySessionRealtime() {
  if (liveWireState.socket || !window.io || !window.auth?.isLoggedIn()) return;

  const token = window.auth.getToken();
  if (!token) return;

  const liveWire = window.io({ auth: { token } });
  liveWireState.socket = liveWire;

  liveWire.on('connect', () => {
    liveWireState.joined = false;
    liveWire.emit('study-session:join', { sessionId });
  });

  liveWire.on('study-session:joined', () => {
    liveWireState.joined = true;
  });

  liveWire.on('study-session:member-status-updated', ({ member }) => {
    applyLiveWireStatus(member);
    loadFocusStatusMix({ showLoading: false });
  });

  liveWire.on('study-session:progress-updated', applyLiveWireProgress);
  liveWire.on('study-session:discussion-updated', handleLiveWireDiscussion);
  liveWire.on('study-session:consultation-started', handleLiveWireConsultationStarted);
  liveWire.on('study-session:consultation-finished', handleLiveWireConsultationFinished);
  liveWire.on('study-session:consultation-reviewed', handleLiveWireConsultationReviewed);
  liveWire.on('study-session:workspace-updated', handleLiveWireWorkspace);
  liveWire.on('study-session:refresh-needed', () => refreshFromLiveWire());
  liveWire.on('study-session:time-updated', () => refreshFromLiveWire());

  liveWire.on('disconnect', () => {
    liveWireState.joined = false;
  });
}
