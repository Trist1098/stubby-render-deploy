// Simple session discussion board.
let discussionPosts = [];
let discussionRequestInFlight = false;

const DISCUSSION_TYPE_LABELS = {
  question: 'Question',
  explanation: 'Explanation',
  resource: 'Resource',
  note: 'Note',
};

function discussionUrl() {
  return `${apiBase}/discussions`;
}

function discussionTypeLabel(type) {
  return DISCUSSION_TYPE_LABELS[type] || 'Question';
}

function isDiscussionOpen() {
  return Boolean(page.discussionPanel?.classList.contains('is-open'));
}

function discussionTime(value) {
  if (!value) return 'Just now';
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function setDiscussionStatus(text = '', type = 'info') {
  if (!page.discussionStatus) return;

  page.discussionStatus.textContent = text;
  page.discussionStatus.className = `discussion-status discussion-status-${type}`;
  page.discussionStatus.classList.toggle('is-visible', Boolean(text));
}

function renderDiscussionPost(post) {
  const displayName = Number(post.user_id) === CURRENT_USER_ID ? 'You' : post.author_name;

  return `
    <article class="discussion-post">
      <header class="discussion-post-header">
        <div>
          <span class="discussion-type discussion-type-${escapeHtml(post.post_type)}">
            ${escapeHtml(discussionTypeLabel(post.post_type))}
          </span>
          <h3>${escapeHtml(post.title || 'Discussion')}</h3>
          <p class="discussion-post-meta">
            ${escapeHtml(displayName || 'Member')} - ${escapeHtml(discussionTime(post.created_at))}
          </p>
        </div>
      </header>
      <p class="discussion-post-content">${escapeHtml(post.content || '')}</p>
    </article>
  `;
}

function renderDiscussionPosts() {
  if (!page.discussionList) return;

  page.discussionList.innerHTML = discussionPosts.length
    ? discussionPosts.map(renderDiscussionPost).join('')
    : '<p class="discussion-empty">No discussion posts yet.</p>';
}

async function loadDiscussions(options = {}) {
  if (discussionRequestInFlight) return;

  discussionRequestInFlight = true;
  if (!options.silent) setDiscussionStatus('Loading discussion...', 'info');

  try {
    const discussion = await getJson(discussionUrl());
    discussionPosts = Array.isArray(discussion.posts) ? discussion.posts : [];
    if (isDiscussionOpen() || !options.silent) renderDiscussionPosts();
    if (!options.silent) setDiscussionStatus('');
  } catch (error) {
    if (!options.silent || isDiscussionOpen()) setDiscussionStatus(error.message, 'danger');
  } finally {
    discussionRequestInFlight = false;
  }
}

async function openDiscussionPanel() {
  page.discussionPanel.classList.add('is-open');
  page.discussionPanel.setAttribute('aria-hidden', 'false');
  renderDiscussionPosts();
  await loadDiscussions({ silent: false });
  window.setTimeout(() => page.discussionTitleInput?.focus(), 0);
}

function closeDiscussionPanel() {
  page.discussionPanel.classList.remove('is-open');
  page.discussionPanel.setAttribute('aria-hidden', 'true');
  page.discussionButton?.focus();
}

async function submitDiscussionPost(event) {
  event.preventDefault();

  const submitButton = page.discussionForm.querySelector('button[type="submit"]');
  const title = page.discussionTitleInput.value.trim();
  const content = page.discussionContentInput.value.trim();
  const postType = page.discussionTypeInput.value;
  if (!title || !content) return;

  setButtonsDisabled([submitButton], true);
  setDiscussionStatus('');

  try {
    await getJson(discussionUrl(), {
      method: 'POST',
      body: JSON.stringify({ title, content, post_type: postType }),
    });
    page.discussionForm.reset();
    await loadDiscussions({ silent: true });
  } catch (error) {
    setDiscussionStatus(error.message, 'danger');
  } finally {
    setButtonsDisabled([submitButton], false);
  }
}

function closeDiscussionPanelOnEscape(event) {
  if (event.key === 'Escape' && isDiscussionOpen()) {
    event.preventDefault();
    closeDiscussionPanel();
  }
}

function startDiscussionPolling() {
  loadDiscussions({ silent: true });
}

function bindDiscussionEvents() {
  page.discussionButton.addEventListener('click', openDiscussionPanel);
  page.closeDiscussionButton.addEventListener('click', closeDiscussionPanel);
  page.discussionForm.addEventListener('submit', submitDiscussionPost);
  document.addEventListener('keydown', closeDiscussionPanelOnEscape);
}
