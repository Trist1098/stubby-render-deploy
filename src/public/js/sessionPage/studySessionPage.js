function bindClick(id, handler) {
  byId(id).addEventListener('click', handler);
}

function bindEvents(bindings) {
  bindings.forEach(([target, type, handler]) => target.addEventListener(type, handler));
}

function bindClicks(bindings) {
  bindings.forEach(([id, handler]) => bindClick(id, handler));
}

function bindBackdropClose(modal, handler) {
  modal.addEventListener('click', (event) => {
    if (event.target === modal) handler();
  });
}

function bindBackdropClosers(bindings) {
  bindings.forEach(([modal, handler]) => bindBackdropClose(modal, handler));
}

function openGoalModal() {
  showModal(page.goalModal, true);
  window.setTimeout(() => page.goalInput?.focus(), 0);
}

function closeGoalModal() {
  resetGoalForm();
  showModal(page.goalModal, false);
}

function toggleMembersExpanded() {
  membersExpanded = !membersExpanded;
  renderMembers();
}

function markScratchpadChanged() {
  markWorkspaceDirty();
  scheduleConsultationWorkspaceSave();
}

function resizeWorkspaceIfOpen() {
  if (!page.consultationWorkspaceModal.classList.contains('d-none')) {
    resizeWhiteboardStage();
  }
}

function bindStudySessionEvents() {
  bindDiscussionEvents();

  bindEvents([
    [page.goalForm, 'submit', addMicroGoal],
    [page.intentionForm, 'submit', saveSessionIntention],
    [page.editMissionButton, 'click', openIntentionModal],
    [page.membersList, 'click', handleMemberActivation],
    [page.membersList, 'click', handleMemberGoalsButton],
    [page.memberGoalsModal, 'submit', handleEvidenceFormSubmit],
    [page.memberGoalsModal, 'change', handleWorkCheckChecklistChange],
    [page.membersToggle, 'click', toggleMembersExpanded],
    ...page.statusControls.map((button) => [button, 'click', updateCurrentStatus]),
    [page.statusProgressBar, 'pointerdown', startProgressDrag],
    [page.statusProgressBar, 'pointermove', moveProgressDrag],
    [page.statusProgressBar, 'pointerup', finishProgressDrag],
    [page.statusProgressBar, 'pointercancel', cancelProgressDrag],
    [page.statusProgressBar, 'keydown', handleProgressKeydown],
    [page.completionForm, 'submit', submitCompletionEvidence],
    [page.extendSessionForm, 'submit', extendExpiredSession],
    [page.endExpiredSessionButton, 'click', exitSession],
    [page.stayExtendedSessionButton, 'click', stayInExtendedSession],
    [page.exitExtendedSessionButton, 'click', leaveExtendedSession],
    [page.consultationScratchpad, 'input', markScratchpadChanged],
    [page.clearWhiteboardButton, 'click', clearWhiteboard],
    [window, 'resize', resizeWorkspaceIfOpen],
    [page.rejoinConsultationButton, 'click', () => openConsultationWorkspace(activeConsultation)],
    [page.consultationReviewForm, 'submit', submitConsultationReview],
    [document, 'keydown', closeVisibleModalOnEscape],
    [document, 'keydown', keepFocusInsideVisibleModal],
  ]);

  bindClicks([
    ['showGoalFormButton', openGoalModal],
    ['closeGoalModalButton', closeGoalModal],
    ['cancelGoalModalButton', closeGoalModal],
    ['exitSessionButton', () => showModal(page.exitModal, true)],
    ['cancelExitButton', () => showModal(page.exitModal, false)],
    ['confirmExitButton', exitSession],
    ['cancelCompletionButton', () => showModal(page.completionModal, false)],
    ['cancelConsultationButton', () => showModal(page.consultationModal, false)],
    ['confirmConsultationButton', startConsultation],
    ['openPendingConsultationChatButton', openConsultationChat],
    ['openConsultationChatButton', openConsultationChat],
    ['closeConsultationWorkspaceButton', closeConsultationWorkspace],
    ['finishConsultationButton', finishConsultation],
    ['cancelConsultationReviewButton', () => showModal(page.consultationReviewModal, false)],
    ['closeConsultationReviewButton', () => showModal(page.consultationReviewModal, false)],
    ['closeConsultationDirectionButton', () => showModal(page.consultationDirectionModal, false)],
    ['viewQueueButton', () => showModal(page.queueModal, true)],
    ['closeQueueButton', () => showModal(page.queueModal, false)],
    ['closeMemberGoalsButton', () => showModal(page.memberGoalsModal, false)],
  ]);

  bindBackdropClosers([
    [page.exitModal, () => showModal(page.exitModal, false)],
    [page.goalModal, closeGoalModal],
    [page.timeExpiryModal, renderTimeExpiryModal],
    [page.queueModal, () => showModal(page.queueModal, false)],
    [page.consultationModal, () => showModal(page.consultationModal, false)],
    [page.consultationWorkspaceModal, closeConsultationWorkspace],
    [page.consultationReviewModal, () => showModal(page.consultationReviewModal, false)],
    [page.consultationDirectionModal, () => showModal(page.consultationDirectionModal, false)],
    [page.memberGoalsModal, () => showModal(page.memberGoalsModal, false)],
    [page.completionModal, () => showModal(page.completionModal, false)],
    [
      page.intentionModal,
      () => {
        if (readSessionIntention()) showModal(page.intentionModal, false);
      },
    ],
  ]);

  startDiscussionPolling();
}

document.addEventListener('DOMContentLoaded', () => {
  if (!requireStudySessionLogin()) return;

  bindPage();
  bindStudySessionEvents();

  startStudySessionRealtime();
  loadSession();
});
