// Micro-goal, progress, and completion actions.
function openMemberGoalsModal(userId) {
  const memberData = (sessionData.members || []).find(
    (item) => Number(item.user_id) === Number(userId),
  );
  if (!memberData) return;

  const displayName = Number(memberData.user_id) === CURRENT_USER_ID ? 'You' : memberData.name;

  page.memberGoalsModalTitle.textContent = `${displayName || 'Member'}: Micro-goals & Uploads`;
  page.memberGoalsModalContent.innerHTML = renderMemberGoals(memberData);
  page.memberGoalsModalContent
    .querySelectorAll('.work-check-form')
    .forEach((form) => loadWorkCheckHistory(form));
  showModal(page.memberGoalsModal, true);
}

function handleMemberGoalsButton(event) {
  const button = event.target.closest('.member-goals-button');
  if (!button) return;

  openMemberGoalsModal(button.dataset.memberUserId);
}

async function addMicroGoal(event) {
  event.preventDefault();

  const title = page.goalInput.value.trim();
  const description = page.goalQuestionInput.value.trim();
  if (!title || !description) {
    showMessage('Add both a micro-goal label and the question or task.', 'danger');
    return;
  }

  try {
    await getJson(`${apiBase}/micro-goals`, {
      method: 'POST',
      body: JSON.stringify({
        title,
        description,
        created_by_user_id: CURRENT_USER_ID,
      }),
    });
    resetGoalForm();
    await loadSession();
  } catch (error) {
    showMessage(error.message, 'danger');
  }
}

function resetGoalForm() {
  page.goalForm.reset();
  page.goalForm.classList.add('d-none');
}

function progressFromPointer(event) {
  const rect = page.statusProgressBar.getBoundingClientRect();
  const offset = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
  const completionSnapDistance = Math.min(Math.max(rect.width * 0.01, 6), 12);
  if (rect.width - offset <= completionSnapDistance) return 100;
  return Math.round((offset / rect.width) * 100);
}

function progressFromKey(event) {
  const currentProgress = asPercent(getCurrentMember()?.progress_percent);
  const step = event.shiftKey ? 10 : 5;

  if (event.key === 'ArrowRight' || event.key === 'ArrowUp') return currentProgress + step;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') return currentProgress - step;
  if (event.key === 'PageUp') return currentProgress + 10;
  if (event.key === 'PageDown') return currentProgress - 10;
  if (event.key === 'Home') return 0;
  if (event.key === 'End') return 100;
  if (event.key === 'Enter' || event.key === ' ') return currentProgress;
  return null;
}

function handleProgressKeydown(event) {
  const progress = progressFromKey(event);
  if (progress === null) return;

  event.preventDefault();
  if (isProgressLocked()) return;
  updateCurrentProgress(asPercent(progress));
}

function isProgressLocked() {
  const currentMember = getCurrentMember();
  const currentGoal = getCurrentMemberGoal();
  return Boolean(
    currentGoal?.is_completed ||
    asPercent(currentMember?.progress_percent) >= 100 ||
    timersPausedForViewer(),
  );
}

function startProgressDrag(event) {
  if (isProgressLocked()) return;

  event.preventDefault();
  activeProgressDrag = {
    pointerId: event.pointerId,
    progress: progressFromPointer(event),
  };
  page.statusProgressBar.classList.add('is-dragging');
  page.statusProgressBar.setPointerCapture?.(event.pointerId);
  paintProgress(activeProgressDrag.progress);
}

function moveProgressDrag(event) {
  if (!activeProgressDrag || activeProgressDrag.pointerId !== event.pointerId) return;

  activeProgressDrag.progress = progressFromPointer(event);
  paintProgress(activeProgressDrag.progress);
}

function finishProgressDrag(event) {
  if (!activeProgressDrag || activeProgressDrag.pointerId !== event.pointerId) return;

  moveProgressDrag(event);
  const progress = activeProgressDrag.progress;
  activeProgressDrag = null;
  page.statusProgressBar.classList.remove('is-dragging');
  if (page.statusProgressBar.hasPointerCapture?.(event.pointerId)) {
    page.statusProgressBar.releasePointerCapture(event.pointerId);
  }
  updateCurrentProgress(progress);
}

function cancelProgressDrag(event) {
  if (!activeProgressDrag || activeProgressDrag.pointerId !== event.pointerId) return;

  activeProgressDrag = null;
  page.statusProgressBar.classList.remove('is-dragging');
  if (page.statusProgressBar.hasPointerCapture?.(event.pointerId)) {
    page.statusProgressBar.releasePointerCapture(event.pointerId);
  }
  renderStatusProgress();
}

function setCompletionAiFeedback(feedback) {
  if (!page.completionAiFeedback) return;

  if (!feedback) {
    page.completionAiFeedback.className = 'completion-ai-feedback completion-ai-feedback-info';
    page.completionAiFeedback.innerHTML =
      '<strong>No AI check saved yet</strong><p>You can still submit your workings to complete this micro-goal.</p>';
    return;
  }

  const status = feedback.status || 'cannot_verify';
  const tone = status === 'looks_good' ? 'success' : 'warning';
  const statusCopy = {
    looks_good: 'Latest AI check looks good',
    needs_more_detail: 'Latest AI check needs more detail',
    cannot_verify: 'Latest AI check cannot verify yet',
  };

  page.completionAiFeedback.className = `completion-ai-feedback completion-ai-feedback-${tone}`;
  page.completionAiFeedback.innerHTML = `
    <strong>${escapeHtml(statusCopy[status] || 'Latest AI feedback')}</strong>
    <p>${escapeHtml(feedback.summary || '')}</p>
    ${feedback.issues?.length ? `<ul>${feedbackList(feedback.issues)}</ul>` : ''}
    ${feedback.next_step ? `<p><b>Next:</b> ${escapeHtml(feedback.next_step)}</p>` : ''}
  `;
}

async function loadCompletionAiFeedback(goalId) {
  if (!page.completionAiFeedback) return;

  page.completionAiFeedback.className = 'completion-ai-feedback completion-ai-feedback-info';
  page.completionAiFeedback.innerHTML = '<strong>Loading latest AI feedback...</strong>';

  try {
    const feedbackListData = await getJson(workCheckHistoryUrl(goalId, CURRENT_USER_ID));
    setCompletionAiFeedback(feedbackListData[0] || null);
  } catch (error) {
    page.completionAiFeedback.className = 'completion-ai-feedback completion-ai-feedback-warning';
    page.completionAiFeedback.innerHTML = `<strong>Could not load latest AI feedback</strong><p>${escapeHtml(error.message)}</p>`;
  }
}

function openCompletionModal() {
  const currentGoal = sessionData.micro_goal;
  if (!currentGoal?.id) {
    showMessage('Choose an active micro-goal before completing progress.', 'danger');
    return;
  }

  page.completionForm.dataset.userId = CURRENT_USER_ID;
  page.completionForm.dataset.goalId = currentGoal.id;
  page.completionForm.reset();
  showModal(page.completionModal, true);
  loadCompletionAiFeedback(currentGoal.id);
}

async function updateCurrentProgress(progress) {
  const currentMember = getCurrentMember();
  const currentGoal = getCurrentMemberGoal();

  if (!currentMember || !sessionData.micro_goal?.id) return;
  if (currentGoal?.is_completed || asPercent(currentMember.progress_percent) >= 100) {
    showMessage('This micro-goal is already locked at 100%.', 'info');
    renderStatusProgress();
    return;
  }
  if (progress >= 100) {
    renderStatusProgress();
    openCompletionModal();
    return;
  }

  syncRenderedStatusTimers();

  try {
    const updatedProgress = await getJson(
      `${apiBase}/micro-goals/${sessionData.micro_goal.id}/progress`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          user_id: CURRENT_USER_ID,
          progress_percent: progress,
        }),
      },
    );
    applyCurrentProgress(asPercent(updatedProgress.progress_percent));
    clearMessage();
  } catch (error) {
    renderStatusProgress();
    showMessage(error.message, 'danger');
  }
}

function applyCurrentProgress(progress) {
  const currentMember = getCurrentMember();
  const currentGoal = getCurrentMemberGoal();
  if (!currentMember || !currentGoal) return;

  currentMember.progress_percent = progress;
  currentGoal.progress_percent = progress;
  renderStatusProgress();
}

async function submitCompletionEvidence(event) {
  event.preventDefault();

  const form = event.target;
  const equationText = form.elements.equation_text.value.trim();
  const file = form.elements.evidence_file.files[0];

  if (!equationText && !file) {
    showMessage('Add your workings or upload a file to mark this as 100%.', 'danger');
    return;
  }
  if (!isSupportedEvidenceFile(file)) {
    showMessage(
      'Only .txt or Word .docx files are supported for completing a micro-goal.',
      'danger',
    );
    return;
  }

  try {
    const formData = new FormData(form);
    formData.set('user_id', form.dataset.userId);
    await postForm(`${apiBase}/micro-goals/${form.dataset.goalId}/evidence`, formData);
    form.reset();
    showModal(page.completionModal, false);
    await loadSession();
    showMessage('Micro-goal completed. Moving to the next queued micro-goal.', 'info');
  } catch (error) {
    showMessage(error.message, 'danger');
  }
}
