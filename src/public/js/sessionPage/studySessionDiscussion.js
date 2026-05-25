// Simple session discussion board.
// Keep discussion posts local so opening the panel can render immediately before a refresh.
let discussionPosts = [];
let discussionRequestInFlight = false;

// Map backend post types to the labels shown in the side panel.
const DISCUSSION_TYPE_LABELS = {
  question: 'Question',
  explanation: 'Explanation',
  resource: 'Resource',
  note: 'Note',
};

// Build the discussion endpoint for the current session.
function discussionUrl() {
  return `${apiBase}/discussions`;
}

// Fall back to "Question" if an older backend returns an unknown type.
function discussionTypeLabel(type) {
  return DISCUSSION_TYPE_LABELS[type] || 'Question';
}

// Check whether the discussion drawer is currently visible.
function isDiscussionOpen() {
  return Boolean(page.discussionPanel?.classList.contains('is-open'));
}

// Show post timestamps in a compact human-readable format.
function discussionTime(value) {
  if (!value) return 'Just now';
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Set the small inline status message inside the discussion panel.
function setDiscussionStatus(text = '', type = 'info') {
  if (!page.discussionStatus) return;

  page.discussionStatus.textContent = text;
  page.discussionStatus.className = `discussion-status discussion-status-${type}`;
  page.discussionStatus.classList.toggle('is-visible', Boolean(text));
}

// Render one discussion post card, showing "You" for the current member.
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

// Render all posts, or a calm empty state when nobody has started the board yet.
function renderDiscussionPosts() {
  if (!page.discussionList) return;

  page.discussionList.innerHTML = discussionPosts.length
    ? discussionPosts.map(renderDiscussionPost).join('')
    : '<p class="discussion-empty">No discussion posts yet.</p>';
}

// Fetch discussion posts with an in-flight guard so repeated opens do not stack requests.
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

// Open the side panel, render cached posts first, then refresh from the server.
async function openDiscussionPanel() {
  page.discussionPanel.classList.add('is-open');
  page.discussionPanel.setAttribute('aria-hidden', 'false');
  renderDiscussionPosts();
  await loadDiscussions({ silent: false });
  window.setTimeout(() => page.discussionTitleInput?.focus(), 0);
}

// Close the discussion drawer and return focus to the button that opened it.
function closeDiscussionPanel() {
  page.discussionPanel.classList.remove('is-open');
  page.discussionPanel.setAttribute('aria-hidden', 'true');
  page.discussionButton?.focus();
}

// Validate and submit a new discussion post, then reload the board.
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

// Let Escape close just the discussion drawer when it is open.
function closeDiscussionPanelOnEscape(event) {
  if (event.key === 'Escape' && isDiscussionOpen()) {
    event.preventDefault();
    closeDiscussionPanel();
  }
}

// Load initial posts once; the panel refreshes again when the user opens it.
function startDiscussionPolling() {
  loadDiscussions({ silent: true });
}

// Wire the discussion drawer controls and form submission.
function bindDiscussionEvents() {
  page.discussionButton.addEventListener('click', openDiscussionPanel);
  page.closeDiscussionButton.addEventListener('click', closeDiscussionPanel);
  page.discussionForm.addEventListener('submit', submitDiscussionPost);
  document.addEventListener('keydown', closeDiscussionPanelOnEscape);
}
