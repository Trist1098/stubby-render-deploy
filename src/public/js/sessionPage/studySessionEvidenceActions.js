// Evidence upload and AI work-check actions.
// Keep the allowed MIME types beside the extension check so uploads stay predictable.
const SUPPORTED_EVIDENCE_TYPES = [
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

// Accept no file, a plain text file, or a Word document; reject everything else early.
function isSupportedEvidenceFile(file) {
  if (!file) return true;
  return (
    /\.(txt|docx)$/i.test(file.name) && (!file.type || SUPPORTED_EVIDENCE_TYPES.includes(file.type))
  );
}

// Lock the AI-review controls while the backend is checking the uploaded work.
function setWorkCheckLoading(form, isLoading) {
  const button = form.querySelector('.ai-review-button');
  const label = button?.querySelector('span');
  if (!button || !label) return;

  form.querySelectorAll('.evidence-action-group button').forEach((item) => {
    item.disabled = isLoading;
  });
  label.textContent = isLoading ? 'Reviewing...' : 'AI Review';
}

// Lock the submit controls while final evidence is being uploaded.
function setEvidenceSubmitLoading(form, isLoading) {
  const button = form.querySelector('.submit-evidence-button');
  const label = button?.querySelector('span');
  if (!button || !label) return;

  form.querySelectorAll('.evidence-action-group button').forEach((item) => {
    item.disabled = isLoading;
  });
  label.textContent = isLoading ? 'Submitting...' : 'Submit';
}

// Turn feedback bullet arrays into escaped list items.
function feedbackList(items) {
  return (items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('');
}

// Convert AI status keys into copy that makes sense to students.
function feedbackStatusLabel(status) {
  const labels = {
    looks_good: 'Looks good',
    needs_more_detail: 'Needs more detail',
    cannot_verify: 'Cannot verify',
  };
  return labels[status] || 'AI feedback';
}

// Build a practical checklist from issues plus the recommended next step.
function workCheckChecklistItems(feedback) {
  const items = [...(feedback.issues || [])];
  if (feedback.next_step) items.push(feedback.next_step);
  return [...new Set(items.map((item) => String(item).trim()).filter(Boolean))];
}

// Scope checklist progress to one AI-check card in local storage.
function checklistStorageKey(checkId) {
  return `${CHECKLIST_STORAGE_PREFIX}${checkId}`;
}

// Read any checklist ticks the student has already saved in this browser.
function readChecklistState(checkId) {
  try {
    return new Set(JSON.parse(localStorage.getItem(checklistStorageKey(checkId))) || []);
  } catch {
    return new Set();
  }
}

// Save checklist ticks locally so the improvement list survives a modal close.
function writeChecklistState(checkId, checkedItems) {
  localStorage.setItem(checklistStorageKey(checkId), JSON.stringify(checkedItems));
}

// Format when an AI check happened without showing a long raw timestamp.
function formatCheckTime(value) {
  if (!value) return 'Just now';
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Render the improvement checklist under an AI feedback card.
function renderWorkCheckChecklist(feedback) {
  const items = workCheckChecklistItems(feedback);
  if (!feedback.id || !items.length) return '';

  const checkedItems = readChecklistState(feedback.id);
  const allChecked = items.every((item) => checkedItems.has(item));

  return `
    <fieldset class="work-check-checklist${allChecked ? ' checklist-ready' : ''}" data-check-id="${feedback.id}">
      <legend>Improvement checklist</legend>
      ${items
        .map((item) => {
          const checked = checkedItems.has(item) ? 'checked' : '';
          return `
            <label>
              <input type="checkbox" data-check-text="${escapeHtml(item)}" ${checked} />
              <span>${escapeHtml(item)}</span>
            </label>
          `;
        })
        .join('')}
      <p>${allChecked ? 'Ready to complete when your evidence is prepared.' : 'Tick items as you improve your work.'}</p>
    </fieldset>
  `;
}

// Render the common body used by current feedback and history cards.
function renderFeedbackBody(feedback, { includeFile = false } = {}) {
  const fileLabel =
    includeFile && feedback.file_name
      ? `<span class="work-check-file">${escapeHtml(feedback.file_type || 'file')}: ${escapeHtml(feedback.file_name)}</span>`
      : '';

  return `
    ${fileLabel}
    <p>${escapeHtml(feedback.summary || '')}</p>
    ${feedback.strengths?.length ? `<span>Strengths</span><ul>${feedbackList(feedback.strengths)}</ul>` : ''}
    ${feedback.issues?.length ? `<span>Improve</span><ul>${feedbackList(feedback.issues)}</ul>` : ''}
    ${feedback.next_step ? `<p><b>Next:</b> ${escapeHtml(feedback.next_step)}</p>` : ''}
    ${renderWorkCheckChecklist(feedback)}
  `;
}

// Render one collapsible AI check from the history list.
function renderWorkCheckCard(feedback, index = 0) {
  const status = feedback.status || 'cannot_verify';

  return `
    <details class="work-check-card work-check-${escapeHtml(status)}" ${index === 0 ? 'open' : ''}>
      <summary>
        <span>
          <strong>${feedbackStatusLabel(status)}</strong>
          <small>${formatCheckTime(feedback.created_at)}</small>
        </span>
        <span class="work-check-status">${feedbackStatusLabel(status)}</span>
      </summary>
      <div class="work-check-card-body">
        ${renderFeedbackBody(feedback, { includeFile: true })}
      </div>
    </details>
  `;
}

// Replace a form's history area with the newest feedback cards.
function renderWorkCheckHistory(form, feedbackListData) {
  const list = form.querySelector('.work-check-history-list');
  if (!list) return;

  list.innerHTML = feedbackListData.length
    ? feedbackListData.map(renderWorkCheckCard).join('')
    : emptyText('No AI checks yet.', 'work-check-empty');
}

// Load previous AI checks for the member and micro-goal shown in this form.
async function loadWorkCheckHistory(form) {
  const list = form.querySelector('.work-check-history-list');
  if (!list) return;

  try {
    const feedbackListData = await getJson(
      workCheckHistoryUrl(form.dataset.goalId, form.dataset.userId),
    );
    renderWorkCheckHistory(form, feedbackListData);
  } catch (error) {
    list.innerHTML = emptyText(error.message, 'work-check-empty work-check-empty-danger');
  }
}

// Persist checklist ticks and update the ready styling immediately.
function handleWorkCheckChecklistChange(event) {
  const checkbox = event.target.closest('.work-check-checklist input[type="checkbox"]');
  if (!checkbox) return;

  const checklist = checkbox.closest('.work-check-checklist');
  const checkId = checklist.dataset.checkId;
  const checkedItems = Array.from(checklist.querySelectorAll('input[type="checkbox"]:checked')).map(
    (item) => item.dataset.checkText,
  );
  const allChecked =
    checkedItems.length === checklist.querySelectorAll('input[type="checkbox"]').length;

  writeChecklistState(checkId, checkedItems);
  checklist.classList.toggle('checklist-ready', allChecked);
  checklist.querySelector('p').textContent = allChecked
    ? 'Ready to complete when your evidence is prepared.'
    : 'Tick items as you improve your work.';
}

// Place fresh AI feedback into the active form.
function setWorkCheckFeedback(form, feedback) {
  const panel = form.querySelector('.work-check-feedback');
  if (!panel) return;

  panel.className = `work-check-feedback work-check-feedback-${feedback.type || 'info'}`;
  panel.innerHTML = `
    <strong>${escapeHtml(feedback.title || 'AI feedback')}</strong>
    ${renderFeedbackBody(feedback)}
  `;
}

// Show a work-check validation or request error in the same feedback area.
function setWorkCheckError(form, message) {
  setWorkCheckFeedback(form, {
    type: 'danger',
    title: 'Check work',
    summary: message,
  });
}

// Route the form submit to either final evidence submission or AI review.
async function handleEvidenceFormSubmit(event) {
  const form = event.target;
  if (!form.classList.contains('work-check-form')) return;
  event.preventDefault();

  if (event.submitter?.dataset.action === 'submit') {
    await submitMemberGoalEvidence(form);
    return;
  }

  await checkWork(form);
}

// Send draft work to the AI reviewer without completing the micro-goal.
async function checkWork(form) {
  const equationText = form.elements.equation_text.value.trim();
  const file = form.elements.evidence_file.files[0];

  if (!equationText && !file) {
    setWorkCheckError(
      form,
      'Add written equations, a .txt file, or a Word .docx file before checking work.',
    );
    return;
  }
  if (!isSupportedEvidenceFile(file)) {
    setWorkCheckError(form, 'AI work check supports .txt or Word .docx files only.');
    return;
  }

  setWorkCheckLoading(form, true);

  try {
    const formData = new FormData(form);
    formData.set('user_id', form.dataset.userId);
    const feedback = await postForm(workCheckUrl(form.dataset.goalId), formData);
    setWorkCheckFeedback(form, { title: 'AI feedback', ...feedback });
    await loadWorkCheckHistory(form);
  } catch (error) {
    setWorkCheckError(form, error.message);
  } finally {
    setWorkCheckLoading(form, false);
  }
}

// Submit evidence as the final proof for a member's micro-goal.
async function submitMemberGoalEvidence(form) {
  const equationText = form.elements.equation_text.value.trim();
  const file = form.elements.evidence_file.files[0];

  if (!equationText && !file) {
    setWorkCheckError(form, 'Add your workings or upload a file before submitting.');
    return;
  }
  if (!isSupportedEvidenceFile(file)) {
    setWorkCheckError(form, 'Only .txt or Word .docx files are supported for submitting evidence.');
    return;
  }

  setEvidenceSubmitLoading(form, true);

  try {
    const formData = new FormData(form);
    formData.set('user_id', form.dataset.userId);
    await postForm(`${apiBase}/micro-goals/${form.dataset.goalId}/evidence`, formData);
    form.reset();
    await loadSession();
    showMessage('Evidence submitted. Moving to the next queued micro-goal.', 'info');
    openMemberGoalsModal(form.dataset.userId);
  } catch (error) {
    setWorkCheckError(form, error.message);
  } finally {
    setEvidenceSubmitLoading(form, false);
  }
}
