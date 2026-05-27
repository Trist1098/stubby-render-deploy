function focusStatusMeta(status) {
  return (
    STATUS_BREAKDOWN_META[normalizeStatusForApi(status)] || {
      label: 'Other',
      color: '#64748b',
    }
  );
}

function formatStatusPercentage(value) {
  const safeValue = asPercent(value);
  if (!safeValue) return '0%';
  return safeValue < 10 && !Number.isInteger(safeValue)
    ? `${safeValue.toFixed(1)}%`
    : `${Math.round(safeValue)}%`;
}

function focusCreditTone(score) {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'reliable';
  if (score >= 55) return 'building';
  return 'starter';
}

function renderFocusCredit(memberData) {
  const credit = memberData.focus_credit || {};
  const score = asPercent(credit.score ?? 45);
  const label = credit.label || 'Getting started';
  const stats = [
    `${Number(credit.focus_minutes) || 0}m focus`,
    `${Number(credit.completed_micro_goals) || 0} goals`,
    `${Number(credit.evidence_uploads) || 0} evidence`,
  ].join(' | ');

  return `
    <div class="focus-credit-strip focus-credit-${focusCreditTone(score)}" aria-label="Focus Credit Score ${score}, ${escapeHtml(label)}">
      <div class="focus-credit-score">
        <span>Focus Credit</span>
        <strong>${score}</strong>
      </div>
      <div class="focus-credit-detail">
        <b>${escapeHtml(label)}</b>
        <span>${escapeHtml(stats)}</span>
      </div>
      <div class="focus-credit-meter" aria-hidden="true">
        <span style="width: ${score}%"></span>
      </div>
    </div>
  `;
}

function updateStatusMixMemberStatus(userId, status) {
  const member = focusStatusMixData?.members?.find(
    (item) => Number(item.user_id) === Number(userId),
  );
  if (!member) return;

  const normalizedStatus = normalizeStatusForApi(status);
  member.current_status_key = normalizedStatus;
  member.current_status = focusStatusMeta(normalizedStatus).label;
}

function statusSecondsByType(member) {
  const secondsByStatus = Object.fromEntries(STATUS_BREAKDOWN_ORDER.map((status) => [status, 0]));

  (member.segments || []).forEach((segment) => {
    const status = normalizeStatusForApi(segment.status);
    if (status in secondsByStatus) {
      secondsByStatus[status] += Math.max(0, Number(segment.seconds) || 0);
    }
  });

  return secondsByStatus;
}

function statusSegments(member) {
  const secondsByStatus = statusSecondsByType(member);
  const totalSeconds = Math.max(
    STATUS_BREAKDOWN_ORDER.reduce((sum, status) => sum + secondsByStatus[status], 0),
    Number(member.total_seconds) || 0,
  );

  return STATUS_BREAKDOWN_ORDER.map((status) => ({
    status,
    ...focusStatusMeta(status),
    seconds: secondsByStatus[status],
    totalSeconds,
    percentage: totalSeconds
      ? Number(((secondsByStatus[status] / totalSeconds) * 100).toFixed(1))
      : 0,
  }));
}

function fallbackStatusMixMember(member, analyticsMember = {}) {
  const status = normalizeStatusForApi(
    analyticsMember.current_status_key ||
      analyticsMember.current_status ||
      member.status_class ||
      member.current_status,
  );
  const seconds = Math.max(
    0,
    Number(analyticsMember.total_seconds) || Number(member.status_timer) || 0,
  );
  const visualSeconds = seconds || 1;

  return {
    ...analyticsMember,
    user_id: member.user_id,
    name: member.name,
    focus_credit: analyticsMember.focus_credit || member.focus_credit,
    current_status_key: status,
    current_status: focusStatusMeta(status).label,
    display_total_seconds: seconds,
    total_seconds: visualSeconds,
    segments: STATUS_BREAKDOWN_ORDER.map((item) => ({
      status: item,
      seconds: item === status ? visualSeconds : 0,
    })),
  };
}

function focusStatusMembers(data) {
  const analyticsByUser = Object.fromEntries(
    (data?.members || []).map((member) => [Number(member.user_id), member]),
  );

  return (sessionData.members || []).map((member) => {
    const analyticsMember = analyticsByUser[Number(member.user_id)] || {};
    return Number(analyticsMember.total_seconds) > 0
      ? {
          ...analyticsMember,
          name: analyticsMember.name || member.name,
          focus_credit: analyticsMember.focus_credit || member.focus_credit,
        }
      : fallbackStatusMixMember(member, analyticsMember);
  });
}

function renderStatusSegment(segment) {
  const percentageText = formatStatusPercentage(segment.percentage);
  const label = segment.percentage >= 12 ? `${escapeHtml(segment.label)} ${percentageText}` : '';

  return `
    <span
      class="status-mix-bar-segment status-${escapeHtml(segment.status)}"
      style="width: ${segment.percentage}%; min-width: ${segment.percentage ? '2px' : '0'}; padding: ${
        segment.percentage ? '0 7px' : '0'
      }; background: ${segment.color}"
      title="${escapeHtml(segment.label)} ${percentageText}"
    >${label}</span>
  `;
}

function renderStatusBreakdownChips(segments) {
  return segments
    .map(
      (segment) => `
        <span class="status-mix-status-chip">
          <i style="background: ${segment.color}"></i>
          <span class="status-mix-chip-text">
            ${escapeHtml(segment.label)} ${formatStatusPercentage(segment.percentage)}
          </span>
        </span>
      `,
    )
    .join('');
}

function refreshFocusStatusMixDom(data = focusStatusMixData) {
  if (data) renderFocusStatusMixChart(data);
}

function renderFocusStatusMixChart(data) {
  const members = focusStatusMembers(data);
  const renderedAt = Date.now();
  if (!members.length) {
    page.statusMixSummary.textContent = 'No activity yet';
    page.statusMixLegend.innerHTML = '';
    page.statusMixChart.innerHTML = '<p class="status-mix-empty">No focus status data yet</p>';
    return;
  }

  page.statusMixSummary.textContent = `${members.length} ${members.length === 1 ? 'Member' : 'Members'}`;

  page.statusMixChart.innerHTML = members
    .map((member) => {
      const segments = statusSegments(member);
      const currentStatus = focusStatusMeta(member.current_status_key || member.current_status);
      return `
        <article class="status-mix-member-row">
          <div class="status-mix-member-heading">
            <strong>${escapeHtml(member.name || 'Member')}</strong>
            <span>
              ${escapeHtml(currentStatus.label)} now -
              <span
                class="status-mix-tracked-time"
                data-tracked-seconds="${member.display_total_seconds ?? segments[0]?.totalSeconds ?? 0}"
                data-tracked-rendered-at="${renderedAt}"
              >${statusTime(member.display_total_seconds ?? segments[0]?.totalSeconds ?? 0)}</span>
              tracked
            </span>
          </div>
          ${renderFocusCredit(member)}
          <div
            class="status-mix-stacked-bar"
            aria-label="${escapeHtml(member.name || 'Member')} focus status percentages"
          >
            ${segments.map(renderStatusSegment).join('')}
          </div>
          <div class="status-mix-status-chips">
            ${renderStatusBreakdownChips(segments)}
          </div>
        </article>
      `;
    })
    .join('');

  page.statusMixLegend.innerHTML = '';
}

function renderFocusStatusTrackedTimers() {
  page.statusMixChart?.querySelectorAll('.status-mix-tracked-time').forEach((item) => {
    const baseSeconds = Number(item.dataset.trackedSeconds) || 0;
    const renderedAt = Number(item.dataset.trackedRenderedAt) || Date.now();
    item.textContent = statusTime(baseSeconds + Math.floor((Date.now() - renderedAt) / 1000));
  });
}

async function loadFocusStatusMix(options = {}) {
  if (options.showLoading !== false) page.statusMixSummary.textContent = 'Loading';
  const requestVersion = ++focusStatusMixRequestVersion;

  try {
    const statusMix = await getJson(focusStatusMixUrl());
    if (requestVersion !== focusStatusMixRequestVersion) return;
    if ((statusUpdateInFlight || pendingStatusUpdate) && focusStatusMixData) return;

    focusStatusMixData = statusMix;
    renderFocusStatusMixChart(statusMix);
  } catch (error) {
    if (requestVersion !== focusStatusMixRequestVersion) return;

    focusStatusMixData = null;
    page.statusMixSummary.textContent = 'Unavailable';
    page.statusMixLegend.innerHTML = '';
    page.statusMixChart.innerHTML = `<p class="status-mix-empty">${escapeHtml(error.message)}</p>`;
  }
}
