function renderMembers() {
  const members = sessionData.members || [];
  const visibleMembers = membersExpanded ? members : members.slice(0, MEMBER_PREVIEW_LIMIT);

  page.membersList.innerHTML = members.length
    ? visibleMembers.map(renderMemberCard).join('')
    : emptyText('No members in this session yet.', 'empty-members');

  page.membersToggle.classList.toggle('d-none', members.length <= MEMBER_PREVIEW_LIMIT);
  page.membersToggle.textContent = membersExpanded ? 'Show less' : `Show all ${members.length}`;
  page.membersToggle.setAttribute('aria-expanded', String(membersExpanded));
  updateRejoinButton();
}

function renderMemberCardInPlace(memberData) {
  const card = page.membersList.querySelector(
    `.session-member-card[data-member-user-id="${memberData.user_id}"]`,
  );
  if (!card) {
    renderMembers();
    return;
  }

  card.outerHTML = renderMemberCard(memberData);
  renderStatusTimers();
}

function renderMemberCard(memberData) {
  const progress = asPercent(memberData.progress_percent);
  const statusClass = memberData.status_class || 'focusing';
  const isNeedHelp = normalizeStatusForApi(statusClass) === 'need_help';
  const isCurrentUser = Number(memberData.user_id) === CURRENT_USER_ID;
  const displayName = isCurrentUser ? 'You' : memberData.name || 'Member';
  const avatarText = isCurrentUser ? 'You' : initials(memberData.name);
  const statusSeconds = Math.max(0, Number(memberData.status_timer) || 0);
  const statusDisplay =
    isNeedHelp && !isCurrentUser
      ? `<button class="member-status status-${escapeHtml(statusClass)} consultation-status-button" type="button" data-consultation-name="${escapeHtml(memberData.name || 'This user')}" data-consultation-user-id="${memberData.user_id}">${escapeHtml(memberData.current_status || 'Focusing')}</button>`
      : `<span class="member-status status-${escapeHtml(statusClass)}">${escapeHtml(memberData.current_status || 'Focusing')}</span>`;

  return `
    <article class="session-member-card status-${escapeHtml(statusClass)}${isCurrentUser ? ' current-user-card' : ''}" data-member-user-id="${memberData.user_id}">
      <div class="member-card-summary">
        <div class="member-avatar">${escapeHtml(avatarText)}</div>
        <div class="member-main">
          <div class="member-name-row">
            <strong>${escapeHtml(displayName)}</strong>
            ${statusDisplay}
          </div>
          <div class="member-meta-row">
            <span
              class="member-status-time"
              data-status-seconds="${statusSeconds}"
              data-status-rendered-at="${Date.now()}"
              data-timer-paused="${memberData.is_timer_paused ? 'true' : 'false'}"
            >${statusTime(statusSeconds)} in status</span>
            <span class="member-progress-value">${progress}%</span>
          </div>
          <div class="member-progress-bar" aria-label="Goal progress ${progress}%">
            <span class="member-progress-fill" style="width: ${progress}%"></span>
          </div>
        </div>
      </div>
      <button
        class="member-goals-button"
        type="button"
        data-member-user-id="${memberData.user_id}"
      >
        <span>Micro-goals & uploads</span>
        <i class="fas fa-arrow-up-right-from-square"></i>
      </button>
    </article>
  `;
}

function getCurrentMember() {
  return (sessionData.members || []).find(
    (memberData) => Number(memberData.user_id) === CURRENT_USER_ID,
  );
}

function getCurrentMemberGoal() {
  const currentGoalId = Number(sessionData.micro_goal?.id);
  return (getCurrentMember()?.goals || []).find((item) => Number(item.id) === currentGoalId);
}

function renderMemberGoals(memberData) {
  const goals = memberData.goals || [];
  const activeGoals = goals.filter(
    (item) =>
      (item.is_current || item.status === 'active') &&
      !item.is_completed &&
      item.status !== 'completed',
  );
  const completedGoals = goals.filter((item) => item.is_completed || item.status === 'completed');
  const canCheckWork = Number(memberData.user_id) === CURRENT_USER_ID;

  return `
    ${renderGoalSection('Doing now', activeGoals, memberData, 'No active micro-goal yet.', canCheckWork)}
    ${renderGoalSection('Completed', completedGoals, memberData, 'No completed micro-goals yet.')}
  `;
}

function renderGoalSection(title, goals, memberData, emptyMessage, allowUpload = false) {
  const content = goals.length
    ? goals.map((item) => renderGoalCard(item, memberData, allowUpload)).join('')
    : emptyText(emptyMessage);

  return `
    <div class="member-goal-section">
      <h4>${title}</h4>
      ${content}
    </div>
  `;
}

function renderGoalCard(goalData, memberData, allowUpload) {
  const progress = asPercent(goalData.progress_percent);
  const canSubmit =
    allowUpload && goalData.status === 'active' && !goalData.is_completed && progress < 100;
  const taskText = goalData.description
    ? `<p class="member-goal-task"><span>Question/task</span>${escapeHtml(goalData.description)}</p>`
    : '';

  return `
    <article class="member-goal-card">
      <div class="member-goal-heading">
        <div>
          <span class="member-goal-status">${escapeHtml(goalData.status || 'active')}</span>
          <strong>${escapeHtml(goalData.title || 'Micro-goal')}</strong>
        </div>
        <span>${progress}%</span>
      </div>
      ${taskText}
      <div class="member-progress-bar member-goal-progress" aria-label="Goal progress ${progress}%">
        <span style="width: ${progress}%"></span>
      </div>
      <div class="member-evidence-list">${renderEvidenceList(goalData.evidence || [])}</div>
      ${canSubmit ? renderEvidenceForm(memberData, goalData) : ''}
    </article>
  `;
}
