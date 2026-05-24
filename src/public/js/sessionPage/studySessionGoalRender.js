// Rendering for the active micro-goal and queued micro-goals.
function renderCurrentGoal() {
  const currentGoal = sessionData.micro_goal;
  page.goalTitle.textContent = currentGoal?.title || 'No micro-goal yet';
  page.goalDescription.textContent =
    currentGoal?.description || 'Add one task to focus this session.';
  renderGoalQueue();
}

function renderGoalQueue() {
  const queuedGoals = sessionData.queued_micro_goals || [];
  const nextGoal = queuedGoals[0];

  page.queuedGoalCount.textContent = queuedGoals.length;
  page.nextQueuedGoal.classList.toggle('d-none', !nextGoal);
  page.nextQueuedGoal.innerHTML = nextGoal
    ? `<span>Next in queue</span><strong>${escapeHtml(nextGoal.title)}</strong>`
    : '';

  page.queuedGoalsList.innerHTML = queuedGoals.length
    ? queuedGoals.map(renderQueuedGoal).join('')
    : emptyText('No queued micro-goals yet.', 'empty-members');
}

function renderQueuedGoal(queuedGoal) {
  return `
    <article class="queued-goal-item">
      <span>${queuedGoal.queue_position || '-'}</span>
      <div>
        <strong>${escapeHtml(queuedGoal.title)}</strong>
        <p>${escapeHtml(queuedGoal.description || 'Queued micro-goal')}</p>
      </div>
    </article>
  `;
}
