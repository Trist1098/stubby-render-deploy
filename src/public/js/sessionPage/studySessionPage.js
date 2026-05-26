// Study-session entrypoint and event binding.
// Attach a click listener by id for simple buttons that do not need custom setup.
function bindClick(id, handler) {
  byId(id).addEventListener('click', handler);
}

// Register a mixed list of event bindings in one readable pass.
function bindEvents(bindings) {
  bindings.forEach(([target, type, handler]) => target.addEventListener(type, handler));
}

// Register simple button click handlers without repeating DOM lookups everywhere.
function bindClicks(bindings) {
  bindings.forEach(([id, handler]) => bindClick(id, handler));
}

// Let users dismiss modal overlays by clicking the backdrop itself.
function bindBackdropClose(modal, handler) {
  modal.addEventListener('click', (event) => {
    if (event.target === modal) handler();
  });
}

// Register every backdrop close rule together so modal behavior is easy to audit.
function bindBackdropClosers(bindings) {
  bindings.forEach(([modal, handler]) => bindBackdropClose(modal, handler));
}

// Show or hide the micro-goal form and focus the first input when it opens.
function toggleGoalForm() {
  page.goalForm.classList.toggle('d-none');
  if (!page.goalForm.classList.contains('d-none')) page.goalInput.focus();
}

// Expand or collapse the member list preview.
function toggleMembersExpanded() {
  membersExpanded = !membersExpanded;
  renderMembers();
}

// Mark the shared scratchpad dirty so the debounced workspace save can pick it up.
function markScratchpadChanged() {
  markWorkspaceDirty();
  scheduleConsultationWorkspaceSave();
}

// Resize the whiteboard only when its modal is visible, avoiding work while hidden.
function resizeWorkspaceIfOpen() {
  if (!page.consultationWorkspaceModal.classList.contains('d-none')) {
    resizeWhiteboardStage();
  }
}

// Wire together the page-level events after all DOM references have been cached.
function bindStudySessionEvents() {
  bindDiscussionEvents();

  // Form submissions, delegated clicks, status controls, drag gestures, and keyboard modal behavior.
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

  // Buttons that only need a direct click action are easier to scan in this smaller list.
  bindClicks([
    ['showGoalFormButton', toggleGoalForm],
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

  // Each modal decides what should happen when its backdrop is clicked.
  bindBackdropClosers([
    [page.exitModal, () => showModal(page.exitModal, false)],
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

// Start the page after login, DOM lookup, event binding, and the first session load.
document.addEventListener('DOMContentLoaded', () => {
  if (!requireStudySessionLogin()) return;

  bindPage();
  bindStudySessionEvents();

  startStudySessionRealtime();
  loadSession();
});
