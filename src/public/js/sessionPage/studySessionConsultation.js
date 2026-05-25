// Consultation chat, review, shared workspace, and whiteboard behavior.
// Open the confirmation modal for starting help with a member.
function openConsultationModal(memberName, memberUserId) {
  pendingConsultationMemberId = Number(memberUserId) || null;
  page.consultationMemberName.textContent = memberName || 'This user';
  showModal(page.consultationModal, true);
}

// Work out the person on the other side of a consultation for chat links.
function consultationOtherUserId(consultation = activeConsultation) {
  if (!consultation) return pendingConsultationMemberId;

  const studentUserId = Number(consultation.student_user_id);
  const teacherUserId = Number(consultation.teacher_user_id);
  return studentUserId === CURRENT_USER_ID ? teacherUserId : studentUserId;
}

// Open or create the one-to-one chat tied to this consultation.
async function openConsultationChat(event) {
  const otherUserId =
    event?.currentTarget?.id === 'openPendingConsultationChatButton'
      ? pendingConsultationMemberId
      : consultationOtherUserId();
  if (!otherUserId) {
    showMessage('Choose a consultation member before opening chat.', 'danger');
    return;
  }

  setButtonsDisabled(
    [page.openPendingConsultationChatButton, page.openConsultationChatButton].filter(Boolean),
    true,
  );

  try {
    const chat = await getJson(sessionMemberChatUrl(otherUserId), { method: 'POST' });
    if (!chat.conversation_id) throw new Error('Chat could not be opened');
    window.location.href = `chat.html?conversationId=${encodeURIComponent(chat.conversation_id)}`;
  } catch (error) {
    setButtonsDisabled(
      [page.openPendingConsultationChatButton, page.openConsultationChatButton].filter(Boolean),
      false,
    );
    showMessage(error.message, 'danger');
  }
}

// Delegate clicks on "Need Help" member statuses into the consultation modal.
function handleMemberActivation(event) {
  const button = event.target.closest('.consultation-status-button');
  if (!button) return;

  openConsultationModal(button.dataset.consultationName, button.dataset.consultationUserId);
}

// Show a lightweight workspace status message when whiteboard or save actions need feedback.
function setConsultationStatus(text, isVisible = true) {
  page.consultationWorkspaceStatus.textContent = text;
  page.consultationWorkspaceStatus.classList.toggle('is-visible', Boolean(isVisible && text));
}

// Keep saved whiteboard coordinates inside the normalized 0..1 drawing space.
function clampUnit(value) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return 0;
  return Math.min(Math.max(numberValue, 0), 1);
}

// Clean server-provided strokes before putting them back into the Konva canvas.
function sanitizeWhiteboardStrokes(strokes) {
  if (!Array.isArray(strokes)) return [];

  return strokes
    .map((stroke) => {
      const points = Array.isArray(stroke?.points)
        ? stroke.points
            .map((point) => ({
              x: clampUnit(point?.x),
              y: clampUnit(point?.y),
            }))
            .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
        : [];
      if (!points.length) return null;

      const width = Number(stroke.width);
      return {
        color: /^#[0-9a-f]{6}$/i.test(stroke.color) ? stroke.color : '#111827',
        width: Number.isFinite(width) ? Math.min(Math.max(width, 1), 12) : 3,
        points,
      };
    })
    .filter(Boolean);
}

// Check whether the local workspace has edits that are newer than the last saved revision.
function hasUnsavedWorkspaceChanges() {
  return workspaceRevision > savedWorkspaceRevision;
}

// Bump the revision every time the scratchpad or whiteboard changes locally.
function markWorkspaceDirty() {
  workspaceRevision += 1;
}

// Mark everything up to a revision as saved.
function markWorkspaceClean(revision = workspaceRevision) {
  savedWorkspaceRevision = Math.max(savedWorkspaceRevision, revision);
}

// Reset local whiteboard and scratchpad state before opening a different consultation.
function resetConsultationWorkspaceState() {
  window.clearTimeout(workspaceSaveTimer);
  workspaceSaveTimer = null;
  workspaceSaveInFlight = false;
  workspaceRevision = 0;
  savedWorkspaceRevision = 0;
  lastWorkspaceUpdatedAt = null;
  whiteboardDrawing = false;
  whiteboardStrokes = [];
  whiteboardCurrentStroke = null;
  whiteboardCurrentLine = null;
  if (page.consultationScratchpad) page.consultationScratchpad.value = '';
  resizeWhiteboardStage();
}

// Resize once immediately and once after layout settles, which helps modal animations.
function scheduleWhiteboardResize() {
  window.requestAnimationFrame(resizeWhiteboardStage);
  window.setTimeout(resizeWhiteboardStage, 120);
}

// Read the current whiteboard size, never letting Konva receive a zero dimension.
function whiteboardSize() {
  const rect = page.consultationWhiteboard?.getBoundingClientRect();
  return {
    width: Math.max(1, Math.round(rect?.width || 1)),
    height: Math.max(1, Math.round(rect?.height || 1)),
  };
}

// Attach pointer/touch handlers to the Konva stage.
function bindWhiteboardStageEvents() {
  whiteboardStage.on('mousedown touchstart', startWhiteboardStroke);
  whiteboardStage.on('mousemove touchmove', moveWhiteboardStroke);
  whiteboardStage.on('mouseup touchend mouseleave touchcancel', finishWhiteboardStroke);
}

// Create the Konva stage on first use and gracefully fall back to the scratchpad if it fails.
function ensureWhiteboardStage() {
  if (!page.consultationWhiteboard) return false;

  if (!window.Konva) {
    setConsultationStatus('Whiteboard failed to load. Scratchpad is still available.');
    if (page.clearWhiteboardButton) page.clearWhiteboardButton.disabled = true;
    return false;
  }

  if (page.clearWhiteboardButton) page.clearWhiteboardButton.disabled = false;
  if (whiteboardStage) return true;

  const { width, height } = whiteboardSize();
  whiteboardStage = new window.Konva.Stage({
    container: page.consultationWhiteboard,
    width,
    height,
  });
  whiteboardLayer = new window.Konva.Layer();
  whiteboardStage.add(whiteboardLayer);
  bindWhiteboardStageEvents();
  return true;
}

// Convert normalized stroke points into the current canvas pixel coordinates.
function whiteboardStrokePoints(stroke) {
  const { width, height } = whiteboardSize();
  const points = (stroke?.points || []).flatMap((point) => [
    clampUnit(point.x) * width,
    clampUnit(point.y) * height,
  ]);

  if (points.length === 2) points.push(points[0] + 0.1, points[1] + 0.1);
  return points;
}

// Build a Konva line from one saved or in-progress stroke.
function createWhiteboardLine(stroke) {
  return new window.Konva.Line({
    points: whiteboardStrokePoints(stroke),
    stroke: stroke.color || '#111827',
    strokeWidth: Number(stroke.width) || 3,
    lineCap: 'round',
    lineJoin: 'round',
    tension: 0.35,
    listening: false,
  });
}

// Clear and redraw the whole whiteboard from the current stroke list.
function redrawWhiteboard() {
  if (!whiteboardLayer || !window.Konva) return;

  whiteboardLayer.destroyChildren();
  whiteboardStrokes.forEach((stroke) => whiteboardLayer.add(createWhiteboardLine(stroke)));
  if (whiteboardCurrentStroke) {
    whiteboardCurrentLine = createWhiteboardLine(whiteboardCurrentStroke);
    whiteboardLayer.add(whiteboardCurrentLine);
  }
  whiteboardLayer.batchDraw();
}

// Resize the Konva stage to match the modal and then redraw normalized strokes.
function resizeWhiteboardStage() {
  if (!ensureWhiteboardStage()) return;

  const { width, height } = whiteboardSize();
  if (whiteboardStage.width() !== width || whiteboardStage.height() !== height) {
    whiteboardStage.size({ width, height });
  }
  redrawWhiteboard();
}

// Convert the current pointer position into normalized whiteboard coordinates.
function getWhiteboardPoint() {
  if (!whiteboardStage) return null;

  const position = whiteboardStage.getPointerPosition();
  if (!position) return null;

  const { width, height } = whiteboardSize();
  return {
    x: clampUnit(position.x / (width || 1)),
    y: clampUnit(position.y / (height || 1)),
  };
}

// Skip points that are too close together so saved strokes stay reasonably small.
function shouldAddWhiteboardPoint(stroke, point) {
  if (!point) return false;
  const previous = stroke.points[stroke.points.length - 1];
  if (!previous) return true;
  const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
  return distance > 0.003;
}

// Begin a new whiteboard stroke and render the first point immediately.
function startWhiteboardStroke(event) {
  if (!activeConsultation || activeConsultation.ended_at || !ensureWhiteboardStage()) return;

  event?.evt?.preventDefault();
  resizeWhiteboardStage();
  const point = getWhiteboardPoint();
  if (!point) return;
  whiteboardDrawing = true;
  whiteboardCurrentStroke = {
    color: '#111827',
    width: 3,
    points: [point],
  };
  whiteboardCurrentLine = createWhiteboardLine(whiteboardCurrentStroke);
  whiteboardLayer.add(whiteboardCurrentLine);
  whiteboardLayer.batchDraw();
}

// Add points to the active stroke while the user drags.
function moveWhiteboardStroke(event) {
  if (!whiteboardDrawing || !whiteboardCurrentStroke) return;

  event?.evt?.preventDefault();
  const point = getWhiteboardPoint();
  if (!shouldAddWhiteboardPoint(whiteboardCurrentStroke, point)) return;
  whiteboardCurrentStroke.points.push(point);
  whiteboardCurrentLine?.points(whiteboardStrokePoints(whiteboardCurrentStroke));
  whiteboardLayer?.batchDraw();
}

// Finish the active stroke, mark the workspace dirty, and queue a save.
function finishWhiteboardStroke(event) {
  if (!whiteboardDrawing || !whiteboardCurrentStroke) return;

  event?.evt?.preventDefault();
  const point = getWhiteboardPoint();
  if (shouldAddWhiteboardPoint(whiteboardCurrentStroke, point)) {
    whiteboardCurrentStroke.points.push(point);
    whiteboardCurrentLine?.points(whiteboardStrokePoints(whiteboardCurrentStroke));
  }

  whiteboardDrawing = false;
  whiteboardStrokes.push(whiteboardCurrentStroke);
  whiteboardCurrentStroke = null;
  whiteboardCurrentLine = null;
  markWorkspaceDirty();
  scheduleConsultationWorkspaceSave();
  whiteboardLayer?.batchDraw();
}

// Clear the shared whiteboard for an active consultation.
function clearWhiteboard() {
  if (!activeConsultation || activeConsultation.ended_at) return;

  whiteboardStrokes = [];
  whiteboardCurrentStroke = null;
  whiteboardCurrentLine = null;
  markWorkspaceDirty();
  scheduleConsultationWorkspaceSave();
  redrawWhiteboard();
}

// Apply a workspace snapshot from the server unless it is the same version we already have.
function applyConsultationWorkspace(workspace) {
  if (workspace?.updated_at && workspace.updated_at === lastWorkspaceUpdatedAt) return;

  lastWorkspaceUpdatedAt = workspace?.updated_at || null;
  whiteboardStrokes = sanitizeWhiteboardStrokes(workspace?.whiteboard_strokes);
  whiteboardCurrentStroke = null;
  if (page.consultationScratchpad) {
    page.consultationScratchpad.value = workspace?.scratchpad_text || '';
  }
  workspaceRevision += 1;
  markWorkspaceClean();
  redrawWhiteboard();
}

// Pull workspace changes from the backend when it is safe not to overwrite local edits.
async function loadConsultationWorkspace(options = {}) {
  if (!activeConsultation?.id) return;
  if (
    !options.force &&
    (whiteboardDrawing || workspaceSaveInFlight || hasUnsavedWorkspaceChanges())
  ) {
    return;
  }

  try {
    const workspace = await getJson(consultationWorkspaceUrl(activeConsultation.id));
    if (
      !options.force &&
      (whiteboardDrawing || workspaceSaveInFlight || hasUnsavedWorkspaceChanges())
    ) {
      return;
    }
    applyConsultationWorkspace(workspace);
  } catch (error) {
    if (!options.silent) setConsultationStatus(error.message);
  }
}

// Save the whiteboard and scratchpad, retrying later if a newer local edit appears mid-save.
async function saveConsultationWorkspace(options = {}) {
  if (!activeConsultation?.id) return;
  if (!options.force && !hasUnsavedWorkspaceChanges()) return;
  if (workspaceSaveInFlight) {
    scheduleConsultationWorkspaceSave();
    return;
  }

  const revisionToSave = workspaceRevision;
  workspaceSaveInFlight = true;
  window.clearTimeout(workspaceSaveTimer);
  workspaceSaveTimer = null;

  try {
    const workspace = await getJson(consultationWorkspaceUrl(activeConsultation.id), {
      method: 'PATCH',
      body: JSON.stringify({
        user_id: CURRENT_USER_ID,
        whiteboard_strokes: whiteboardStrokes,
        scratchpad_text: page.consultationScratchpad?.value || '',
      }),
    });

    lastWorkspaceUpdatedAt = workspace.updated_at || lastWorkspaceUpdatedAt;
    markWorkspaceClean(revisionToSave);
    if (hasUnsavedWorkspaceChanges()) scheduleConsultationWorkspaceSave();
  } catch (error) {
    if (!options.silent) setConsultationStatus(error.message);
  } finally {
    workspaceSaveInFlight = false;
  }
}

// Debounce workspace saves so drawing does not send a request for every single pointer move.
function scheduleConsultationWorkspaceSave() {
  window.clearTimeout(workspaceSaveTimer);
  workspaceSaveTimer = window.setTimeout(() => {
    saveConsultationWorkspace({ silent: true });
  }, 700);
}

// Start polling the shared workspace while the consultation modal is open.
function startConsultationWorkspacePolling() {
  window.clearInterval(workspacePollTimer);
  workspacePollTimer = window.setInterval(() => {
    loadConsultationWorkspace({ silent: true });
  }, 5000);
}

// Stop polling after the workspace closes so hidden modals do not keep doing work.
function stopConsultationWorkspacePolling() {
  window.clearInterval(workspacePollTimer);
  workspacePollTimer = null;
}

// Render the student and question context at the top of the consultation workspace.
function renderConsultationContext() {
  if (!activeConsultation) return;

  page.consultationWorkspaceTitle.textContent = activeConsultation.topic || 'Study consultation';
  page.consultationContext.innerHTML = `
    <div class="consultation-context-card">
      <span>Student</span>
      <strong>${escapeHtml(activeConsultation.student_name || 'Student')}</strong>
    </div>
    <div class="consultation-context-card consultation-context-card-wide">
      <span>Question</span>
      <p>${escapeHtml(activeConsultation.question_text || 'No question captured.')}</p>
    </div>
  `;
}

// Update workspace controls based on whether the consultation is still active.
function renderConsultationWorkspace() {
  if (!activeConsultation) return;

  const isCompleted =
    activeConsultation.status === 'completed' || Boolean(activeConsultation.ended_at);

  renderConsultationContext();
  setConsultationStatus('', false);
  const finishButton = byId('finishConsultationButton');
  finishButton.disabled = isCompleted;
  finishButton.textContent = isCompleted ? 'Ended' : 'End Consultation';
  page.openConsultationChatButton.disabled = !consultationOtherUserId();
}

// Open the shared consultation workspace and start loading/syncing its contents.
function openConsultationWorkspace(consultation) {
  activeConsultation = consultation;
  resetConsultationWorkspaceState();
  renderConsultationWorkspace();
  showModal(page.consultationWorkspaceModal, true);
  window.requestAnimationFrame(() => {
    scheduleWhiteboardResize();
    loadConsultationWorkspace({ force: true, silent: true });
    startConsultationWorkspacePolling();
  });
  updateRejoinButton();
}

// Save one last time, stop syncing, and hide the workspace modal.
function closeConsultationWorkspace() {
  saveConsultationWorkspace({ silent: true });
  stopConsultationWorkspacePolling();
  showModal(page.consultationWorkspaceModal, false);
  updateRejoinButton();
}

// Open the teacher review modal after a consultation ends.
function openConsultationReviewModal(consultation = activeConsultation) {
  if (!consultation) return;

  activeConsultation = consultation;
  const studentName = consultation.student_name || 'the student';
  page.consultationReviewPrompt.textContent = `Send ${studentName} a concise direction or next step.`;
  page.consultationReviewForm.elements.teacher_direction.value =
    consultation.teacher_direction || '';
  const selectedChecklist = new Set(consultation.reflection?.summary_checklist || []);
  page.consultationReviewForm
    .querySelectorAll('input[name="summary_checklist"]')
    .forEach((item) => {
      item.checked = selectedChecklist.has(item.value);
    });
  showModal(page.consultationReviewModal, true);
  page.consultationReviewForm.elements.teacher_direction.focus();
}

// Show the direction that a teacher left for the student.
function openConsultationDirectionModal(consultation = activeConsultation) {
  if (!consultation?.teacher_direction) return;

  activeConsultation = consultation;
  page.consultationDirectionText.textContent = consultation.teacher_direction;
  showModal(page.consultationDirectionModal, true);
}

// Notify participants after a consultation ends, with a review action for the teacher.
function showConsultationEndedToast(consultation) {
  const isTeacher = Number(consultation.teacher_user_id) === CURRENT_USER_ID;

  if (isTeacher) {
    showToast({
      title: 'Consultation ended',
      message: `Add a direction or next step for ${consultation.student_name || 'the student'}.`,
      type: 'info',
      actionLabel: 'Review',
      action: () => openConsultationReviewModal(consultation),
    });
    return;
  }

  showToast({
    title: 'Consultation ended',
    message: 'Both members are focusing again.',
    type: 'success',
  });
}

// Notify users when a teacher direction is available to read.
function showStudentDirectionToast(consultation) {
  if (!consultation?.teacher_direction) return;

  const title =
    Number(consultation.student_user_id) === CURRENT_USER_ID
      ? 'Direction / next step'
      : `${consultation.student_name || 'Student'} receives direction`;

  showToast({
    title,
    message: consultation.teacher_direction,
    type: 'success',
    actionLabel: 'Read only',
    action: () => openConsultationDirectionModal(consultation),
  });
}

// Create a consultation between the current user and the selected member.
async function startConsultation() {
  const memberData = (sessionData.members || []).find(
    (item) => Number(item.user_id) === pendingConsultationMemberId,
  );
  if (!memberData) {
    showMessage('Choose a member who needs help before starting consultation.', 'danger');
    return;
  }

  const button = byId('confirmConsultationButton');
  button.disabled = true;
  button.textContent = 'Starting...';

  try {
    const consultation = await getJson(consultationUrl(), {
      method: 'POST',
      body: JSON.stringify({
        student_user_id: memberData.user_id,
        teacher_user_id: CURRENT_USER_ID,
      }),
    });

    showModal(page.consultationModal, false);
    openConsultationWorkspace(consultation);
    await loadSession();
  } catch (error) {
    showMessage(error.message, 'danger');
  } finally {
    button.disabled = false;
    button.textContent = 'Start Consultation';
  }
}

// Finish the active consultation after saving the latest workspace state.
async function finishConsultation(event) {
  event?.preventDefault();
  if (!activeConsultation || activeConsultation.ended_at) return;

  const payload = {
    submitted_by_user_id: CURRENT_USER_ID,
  };

  const button = byId('finishConsultationButton');
  button.disabled = true;

  try {
    await saveConsultationWorkspace({ force: true, silent: false });
    activeConsultation = await getJson(consultationFinishUrl(activeConsultation.id), {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });

    closeConsultationWorkspace();
    await loadSession();
    showConsultationEndedToast(activeConsultation);
  } catch (error) {
    setConsultationStatus(error.message);
  } finally {
    if (!activeConsultation?.ended_at) button.disabled = false;
  }
}

// Save the teacher's direction and reflection checklist after a consultation.
async function submitConsultationReview(event) {
  event.preventDefault();
  if (!activeConsultation) return;

  const form = event.target;
  const teacherDirection = form.elements.teacher_direction.value.trim();
  if (!teacherDirection) {
    showToast({
      title: 'Direction needed',
      message: 'Add a direction or next step before sending.',
      type: 'danger',
    });
    return;
  }

  const button = byId('submitConsultationReviewButton');
  button.disabled = true;
  const summaryChecklist = Array.from(
    form.querySelectorAll('input[name="summary_checklist"]:checked'),
  ).map((item) => item.value);

  try {
    activeConsultation = await getJson(consultationReviewUrl(activeConsultation.id), {
      method: 'PATCH',
      body: JSON.stringify({
        submitted_by_user_id: CURRENT_USER_ID,
        teacher_direction: teacherDirection,
        summary_checklist: summaryChecklist,
      }),
    });

    showModal(page.consultationReviewModal, false);
    form.reset();
    showStudentDirectionToast(activeConsultation);
  } catch (error) {
    showToast({
      title: 'Review not sent',
      message: error.message,
      type: 'danger',
    });
  } finally {
    button.disabled = false;
  }
}

