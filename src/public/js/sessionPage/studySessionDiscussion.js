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

function discussionFileSize(size) {
  const bytes = Number(size) || 0;
  if (bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function setDiscussionStatus(text = '', type = 'info') {
  if (!page.discussionStatus) return;

  page.discussionStatus.textContent = text;
  page.discussionStatus.className = `discussion-status discussion-status-${type}`;
  page.discussionStatus.classList.toggle('is-visible', Boolean(text));
}

function discussionAttachmentIcon(type = '') {
  const kind = String(type || '');
  if (kind.startsWith('image/')) return 'fa-image';
  if (kind.includes('pdf')) return 'fa-file-pdf';
  if (kind.includes('word')) return 'fa-file-word';
  if (kind.includes('sheet') || kind.includes('excel')) return 'fa-file-excel';
  if (kind.includes('presentation') || kind.includes('powerpoint')) return 'fa-file-powerpoint';
  return 'fa-paperclip';
}

function renderDiscussionAttachment(post) {
  if (!post.attachment_url) return '';

  const fileName = post.attachment_name || 'Attachment';
  const fileSize = discussionFileSize(post.attachment_size);
  const isImage = String(post.attachment_type || '').startsWith('image/');

  return `
    <a
      class="discussion-attachment"
      href="${escapeHtml(post.attachment_url)}"
      target="_blank"
      rel="noopener noreferrer"
      download="${escapeHtml(fileName)}"
    >
      ${
        isImage
          ? `<img src="${escapeHtml(post.attachment_url)}" alt="${escapeHtml(fileName)}" />`
          : `<i class="fas ${escapeHtml(discussionAttachmentIcon(post.attachment_type))}" aria-hidden="true"></i>`
      }
      <span>
        <strong>${escapeHtml(fileName)}</strong>
        ${fileSize ? `<small>${escapeHtml(fileSize)}</small>` : ''}
      </span>
    </a>
  `;
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
      ${post.content ? `<p class="discussion-post-content">${escapeHtml(post.content)}</p>` : ''}
      ${renderDiscussionAttachment(post)}
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
  const file = page.discussionFileInput?.files?.[0] || null;

  if (!title) {
    setDiscussionStatus('Add a title before posting.', 'danger');
    page.discussionTitleInput.focus();
    return;
  }

  if (!content && !file) {
    setDiscussionStatus('Add a message or attach a file before posting.', 'danger');
    page.discussionContentInput.focus();
    return;
  }

  const postData = new FormData();
  postData.append('title', title);
  postData.append('content', content);
  postData.append('post_type', postType);
  if (file) postData.append('file', file);

  setButtonsDisabled([submitButton], true);
  setDiscussionStatus('');

  try {
    await postForm(discussionUrl(), postData);
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
