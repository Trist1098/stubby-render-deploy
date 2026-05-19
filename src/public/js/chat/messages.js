import { fetchMessages, sendMessageRequest, uploadFileRequest, uploadVoiceRequest, editMessageRequest, deleteMessageRequest, addReactionRequest, removeReactionRequest, fetchPinnedMessages, pinMessageRequest, unpinMessageRequest } from './chatApi.js';
import { chatState } from './chatState.js';
import {
  escapeHtml,
  formatTime,
  getActiveConversation,
  getConversationName,
  getCurrentUserId,
} from './chatUtils.js';
import { renderConversationList } from './conversations.js';

let voiceRecorder = null;
let voiceChunks = [];
let voiceRecordingStart = null;
let voiceTimerInterval = null;
let voiceDiscarded = false;
const reactionChoices = ['\u{1F44D}', '\u{2764}\u{FE0F}', '\u{1F602}', '\u{1F62E}', '\u{1F622}', '\u{1F389}'];

function cleanupVoiceState() {
  if (voiceRecorder && voiceRecorder.state !== 'inactive') {
    voiceDiscarded = true;
    voiceRecorder.stop();
  }
  voiceRecorder = null;
  voiceChunks = [];
  voiceRecordingStart = null;
  if (voiceTimerInterval) clearInterval(voiceTimerInterval);
  voiceTimerInterval = null;
  voiceDiscarded = false;
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function renderEmptyChat() {
  const panel = document.getElementById('chatPanel');
  panel.className = 'chat-panel flex-grow-1 d-flex align-items-center justify-content-center';
  panel.innerHTML = `
    <div class="text-center text-muted">
      <i class="fas fa-comments fa-3x mb-3 opacity-25"></i>
      <p class="mb-0">Select a conversation or create a new one</p>
    </div>`;
}

export function renderChatPanel() {
  cleanupVoiceState();

  const panel = document.getElementById('chatPanel');
  const conv = getActiveConversation();

  if (!conv) {
    renderEmptyChat();
    return;
  }

  panel.className = 'chat-panel flex-grow-1 d-flex flex-column';
  panel.innerHTML = `
    <div class="chat-header d-flex align-items-center justify-content-between gap-3 px-3 border-bottom">
      <div class="min-w-0">
        <div class="fw-bold text-truncate">${escapeHtml(getConversationName(conv))}</div>
        <div class="text-muted small">${conv.type === 'group' ? 'Group conversation' : 'Direct message'}</div>
      </div>
      <select class="form-select form-select-sm wallpaper-picker" id="wallpaperPicker" aria-label="Chat wallpaper">
        <option value="default" ${chatState.activeWallpaper === 'default' ? 'selected' : ''}>Dots</option>
        <option value="soft" ${chatState.activeWallpaper === 'soft' ? 'selected' : ''}>Soft</option>
        <option value="grid" ${chatState.activeWallpaper === 'grid' ? 'selected' : ''}>Grid</option>
      </select>
    </div>
    ${renderPinnedBar()}
    <div class="messages-list chat-wallpaper ${chatState.activeWallpaper === 'default' ? '' : chatState.activeWallpaper} flex-grow-1 overflow-auto" id="messagesList">
      ${renderMessages()}
    </div>
    <form class="message-composer d-flex gap-2 p-3 border-top" id="messageForm">
      <label class="btn btn-outline-secondary flex-shrink-0" for="fileInput" title="Attach file">
        <i class="fas fa-paperclip"></i>
      </label>
      <input type="file" id="fileInput" class="d-none">
      <button class="btn btn-outline-secondary flex-shrink-0" id="voiceBtn" type="button" title="Record voice message">
        <i class="fas fa-microphone"></i>
      </button>
      <input class="form-control" id="messageInput" type="text" placeholder="Type a message" autocomplete="off">
      <button class="btn btn-primary flex-shrink-0" type="submit">
        <i class="fas fa-paper-plane me-1"></i> Send
      </button>
    </form>`;

  document.getElementById('wallpaperPicker').addEventListener('change', (event) => {
    chatState.activeWallpaper = event.target.value;
    localStorage.setItem('chatWallpaper', chatState.activeWallpaper);
    renderChatPanel();
    scrollMessagesToBottom('auto');
  });

  const pinnedBar = document.getElementById('pinnedBar');
  if (pinnedBar) pinnedBar.addEventListener('click', handlePinnedBarClick);

  document.getElementById('messageForm').addEventListener('submit', sendActiveMessage);
  document.getElementById('fileInput').addEventListener('change', (e) => {
    if (e.target.files[0]) sendActiveFile(e.target.files[0]);
    e.target.value = '';
  });
  document.getElementById('voiceBtn').addEventListener('click', startVoiceRecording);

  const messagesList = document.getElementById('messagesList');
  messagesList.addEventListener('click', handleMessageAction);
  messagesList.addEventListener('dragover', (e) => {
    e.preventDefault();
    messagesList.classList.add('drag-over');
  });
  messagesList.addEventListener('dragleave', () => messagesList.classList.remove('drag-over'));
  messagesList.addEventListener('drop', (e) => {
    e.preventDefault();
    messagesList.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) sendActiveFile(file);
  });

  scrollMessagesToBottom('auto');
}

function renderMessageList(shouldScroll = false) {
  const list = document.getElementById('messagesList');
  if (!list) return;

  const wasNearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 120;
  list.innerHTML = renderMessages();

  if (shouldScroll || wasNearBottom) {
    scrollMessagesToBottom('smooth');
  }
}

function renderMessages() {
  if (chatState.activeMessages.length === 0) {
    return '<div class="text-center text-muted small py-5">No messages yet. Start the conversation.</div>';
  }

  const currentUserId = getCurrentUserId();
  return chatState.activeMessages
    .map((message) => {
      const isSent = Number(message.sender_id) === Number(currentUserId);
      const animationClass = chatState.animatedMessageIds.has(message.message_id)
        ? ''
        : 'new-message';
      chatState.animatedMessageIds.add(message.message_id);
      const editedLabel = message.edited_at && !message.is_deleted
        ? `<span class="msg-edited" title="Edited ${formatTime(message.edited_at)}">(edited)</span>`
        : '';

      const isPinned = chatState.pinnedMessages.some((p) => p.message_id === message.message_id);

      const ddItems = [];
      if (!message.is_deleted) {
        ddItems.push(`<button class="msg-dd-item pin-btn ${isPinned ? 'pinned' : ''}" data-message-id="${message.message_id}"><i class="fas fa-thumbtack me-2"></i>${isPinned ? 'Unpin' : 'Pin'}</button>`);
      }
      if (isSent && message.text && !message.file_url && !message.is_deleted) {
        ddItems.push(`<button class="msg-dd-item edit-btn" data-message-id="${message.message_id}"><i class="fas fa-pen me-2"></i>Edit</button>`);
      }
      if (isSent && !message.is_deleted) {
        ddItems.push(`<button class="msg-dd-item delete-btn" data-message-id="${message.message_id}"><i class="fas fa-trash me-2"></i>Delete</button>`);
      }

      const moreBtn = ddItems.length > 0
        ? `<button class="msg-more-btn" data-message-id="${message.message_id}" title="More"><i class="fas fa-ellipsis-h"></i></button>`
        : '';
      const dropdown = ddItems.length > 0
        ? `<div class="msg-dropdown" data-message-id="${message.message_id}">${ddItems.join('')}</div>`
        : '';
      const reactionWrap = !message.is_deleted
        ? `<div class="msg-reaction-wrap"><button class="msg-action-btn reaction-toggle-btn" data-message-id="${message.message_id}" title="React"><i class="far fa-smile"></i></button></div>`
        : '';

      return `
      <div class="message-row ${isSent ? 'sent' : 'received'} ${animationClass}" data-message-id="${message.message_id}">
        ${isSent ? reactionWrap : ''}
        <div class="message-bubble">
          <div class="message-meta d-flex align-items-center gap-2 mb-1">
            <span class="flex-grow-1">${escapeHtml(message.sender_username)} | ${formatTime(message.created_at)}</span>
            ${moreBtn}
          </div>
          ${dropdown}
          ${renderMessageContent(message)}
          ${editedLabel}
          ${renderReactions(message)}
        </div>
        ${!isSent ? reactionWrap : ''}
      </div>`;
    })
    .join('');
}

function renderReactions(message) {
  if (!message.reactions || message.reactions.length === 0 || message.is_deleted) return '';

  const currentUserId = Number(getCurrentUserId());
  const grouped = message.reactions.reduce((items, reaction) => {
    if (!items[reaction.emoji]) {
      items[reaction.emoji] = { count: 0, reacted: false };
    }
    items[reaction.emoji].count += 1;
    if (Number(reaction.user_id) === currentUserId) items[reaction.emoji].reacted = true;
    return items;
  }, {});

  return `<div class="msg-reactions">
    ${Object.entries(grouped).map(([emoji, item]) => `
      <button class="msg-reaction ${item.reacted ? 'reacted' : ''}" data-message-id="${message.message_id}" data-emoji="${escapeHtml(emoji)}" type="button">
        <span>${escapeHtml(emoji)}</span>
        <span>${item.count}</span>
      </button>
    `).join('')}
  </div>`;
}

function renderMessageContent(message) {
  if (message.is_deleted) {
    return `<span class="msg-deleted"><i class="fas fa-ban me-1"></i>This message was deleted</span>`;
  }
  if (message.file_url) {
    if (message.file_type && message.file_type.startsWith('audio/')) {
      return renderVoiceMessage(message);
    }
    const isImage = message.file_type && message.file_type.startsWith('image/');
    const fileDetails = renderFileDetails(message);
    if (isImage) {
      return `<a href="${escapeHtml(message.file_url)}" target="_blank" rel="noopener noreferrer">
        <img src="${escapeHtml(message.file_url)}" alt="${escapeHtml(message.file_name || 'Image')}" class="msg-image">
      </a>
      ${fileDetails}`;
    }
    return `<a href="${escapeHtml(message.file_url)}" target="_blank" rel="noopener noreferrer" download="${escapeHtml(message.file_name || 'file')}" class="msg-file-link">
      <i class="fas fa-file me-1"></i>${escapeHtml(message.file_name || 'File')}
    </a>
    ${fileDetails}`;
  }
  return `<div>${escapeHtml(message.text || '')}</div>`;
}

function renderVoiceMessage(message) {
  const durationLabel = message.duration != null ? formatDuration(message.duration) : '';
  return `
    <div class="msg-voice d-flex align-items-center gap-2">
      <i class="fas fa-microphone-alt text-primary"></i>
      <audio controls src="${escapeHtml(message.file_url)}" class="msg-audio"></audio>
      ${durationLabel ? `<span class="msg-voice-duration text-muted small">${escapeHtml(durationLabel)}</span>` : ''}
    </div>`;
}

function renderFileDetails(message) {
  const fileName = message.file_name || 'File';
  const fileSize = formatFileSize(message.file_size);
  return `<div class="msg-file-meta">${escapeHtml(fileName)}${fileSize ? ` | ${fileSize}` : ''}</div>`;
}

function formatFileSize(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size <= 0) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function closeAllDropdowns() {
  document.querySelectorAll('.msg-dropdown.open').forEach((d) => d.classList.remove('open'));
}

function handleMessageAction(e) {
  const moreBtn = e.target.closest('.msg-more-btn');
  if (moreBtn) {
    const dropdown = document.querySelector(`.msg-dropdown[data-message-id="${moreBtn.dataset.messageId}"]`);
    const isOpen = dropdown?.classList.contains('open');
    closeAllDropdowns();
    if (!isOpen && dropdown) dropdown.classList.add('open');
    return;
  }

  if (!e.target.closest('.msg-dropdown')) closeAllDropdowns();

  const editBtn = e.target.closest('.edit-btn');
  if (editBtn) startEditMessage(Number(editBtn.dataset.messageId));
  const deleteBtn = e.target.closest('.delete-btn');
  if (deleteBtn) confirmDeleteMessage(Number(deleteBtn.dataset.messageId));
  const pinBtn = e.target.closest('.pin-btn');
  if (pinBtn) togglePin(Number(pinBtn.dataset.messageId), pinBtn.classList.contains('pinned'));
  const reactionToggleBtn = e.target.closest('.reaction-toggle-btn');
  if (reactionToggleBtn) showReactionPicker(Number(reactionToggleBtn.dataset.messageId));
  const pickerBtn = e.target.closest('.reaction-picker-btn');
  if (pickerBtn) addReaction(Number(pickerBtn.dataset.messageId), pickerBtn.dataset.emoji);
  const reactionBtn = e.target.closest('.msg-reaction');
  if (reactionBtn) toggleReaction(Number(reactionBtn.dataset.messageId), reactionBtn.dataset.emoji);
}

function showReactionPicker(messageId) {
  document.querySelectorAll('.reaction-picker').forEach((picker) => picker.remove());

  const row = document.querySelector(`.message-row[data-message-id="${messageId}"]`);
  if (!row) return;

  const picker = document.createElement('div');
  picker.className = 'reaction-picker';
  picker.innerHTML = reactionChoices.map((emoji) => `
    <button class="reaction-picker-btn" data-message-id="${messageId}" data-emoji="${escapeHtml(emoji)}" type="button">${escapeHtml(emoji)}</button>
  `).join('');

  row.querySelector('.message-bubble').appendChild(picker);
}

async function addReaction(messageId, emoji) {
  const result = await addReactionRequest(chatState.activeConversationId, messageId, emoji);
  updateMessageReactions(messageId, result);
}

async function toggleReaction(messageId, emoji) {
  const message = chatState.activeMessages.find((m) => m.message_id === messageId);
  const currentUserId = Number(getCurrentUserId());
  const hasReacted = message?.reactions?.some(
    (reaction) => reaction.emoji === emoji && Number(reaction.user_id) === currentUserId,
  );
  const result = hasReacted
    ? await removeReactionRequest(chatState.activeConversationId, messageId, emoji)
    : await addReactionRequest(chatState.activeConversationId, messageId, emoji);
  updateMessageReactions(messageId, result);
}

function updateMessageReactions(messageId, result) {
  if (!result || !Array.isArray(result.reactions)) {
    alert(result?.message || 'Failed to update reaction.');
    return;
  }
  const idx = chatState.activeMessages.findIndex((m) => m.message_id === messageId);
  if (idx !== -1) chatState.activeMessages[idx].reactions = result.reactions;
  renderMessageList(false);
}

async function confirmDeleteMessage(messageId) {
  if (!confirm('Delete this message?')) return;
  const result = await deleteMessageRequest(chatState.activeConversationId, messageId);
  if (!result || !result.message_id) {
    alert(result?.message || 'Failed to delete message.');
    return;
  }
  const idx = chatState.activeMessages.findIndex((m) => m.message_id === messageId);
  if (idx !== -1) chatState.activeMessages[idx].is_deleted = true;
  renderMessageList(false);
}

function startEditMessage(messageId) {
  const message = chatState.activeMessages.find((m) => m.message_id === messageId);
  if (!message) return;
  const row = document.querySelector(`.message-row[data-message-id="${messageId}"]`);
  if (!row) return;
  const bubble = row.querySelector('.message-bubble');
  bubble.innerHTML = `
    <div class="message-meta mb-1">${escapeHtml(message.sender_username)} | ${formatTime(message.created_at)}</div>
    <div class="msg-edit-form">
      <input class="form-control form-control-sm msg-edit-input" value="${escapeHtml(message.text || '')}" autocomplete="off">
      <div class="d-flex gap-2 mt-1">
        <button class="btn btn-sm btn-primary msg-edit-save" type="button">Save</button>
        <button class="btn btn-sm btn-outline-secondary msg-edit-cancel" type="button">Cancel</button>
      </div>
    </div>`;
  const input = bubble.querySelector('.msg-edit-input');
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
  bubble.querySelector('.msg-edit-save').addEventListener('click', () => saveEditMessage(messageId, input.value));
  bubble.querySelector('.msg-edit-cancel').addEventListener('click', () => renderMessageList(false));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) saveEditMessage(messageId, input.value);
    if (e.key === 'Escape') renderMessageList(false);
  });
}

async function saveEditMessage(messageId, newText) {
  const text = newText.trim();
  if (!text) return;
  const result = await editMessageRequest(chatState.activeConversationId, messageId, text);
  if (!result || !result.message_id) {
    alert(result?.message || 'Failed to edit message.');
    renderMessageList(false);
    return;
  }
  const idx = chatState.activeMessages.findIndex((m) => m.message_id === messageId);
  if (idx !== -1) {
    chatState.activeMessages[idx] = {
      ...chatState.activeMessages[idx],
      text: result.text,
      edited_at: result.edited_at,
    };
  }
  renderMessageList(false);
}

function renderPinnedBar() {
  if (chatState.pinnedMessages.length === 0) return '';
  const items = chatState.pinnedMessages.map((pin) => {
    const snippet = pin.is_deleted
      ? 'This message was deleted'
      : pin.text || pin.file_name || 'File';
    return `
      <div class="pinned-item d-flex align-items-center gap-2 px-3 py-1" data-message-id="${pin.message_id}">
        <span class="pinned-item-text text-truncate small flex-grow-1">${escapeHtml(snippet)}</span>
        <button class="pinned-unpin-btn msg-action-btn" data-message-id="${pin.message_id}" title="Unpin"><i class="fas fa-times"></i></button>
      </div>`;
  }).join('');
  return `
    <div class="pinned-bar border-bottom" id="pinnedBar">
      <div class="pinned-bar-header d-flex align-items-center gap-2 px-3 py-1" id="pinnedBarToggle">
        <i class="fas fa-thumbtack pinned-icon"></i>
        <span class="small fw-semibold">${chatState.pinnedMessages.length} pinned</span>
        <i class="fas fa-chevron-down pinned-chevron ms-auto" id="pinnedChevron"></i>
      </div>
      <div class="pinned-items d-none" id="pinnedItems">${items}</div>
    </div>`;
}

function handlePinnedBarClick(e) {
  const unpinBtn = e.target.closest('.pinned-unpin-btn');
  if (unpinBtn) {
    togglePin(Number(unpinBtn.dataset.messageId), true);
    return;
  }
  const toggle = e.target.closest('#pinnedBarToggle');
  if (toggle) {
    const list = document.getElementById('pinnedItems');
    const chevron = document.getElementById('pinnedChevron');
    if (!list) return;
    list.classList.toggle('d-none');
    chevron.classList.toggle('fa-chevron-down');
    chevron.classList.toggle('fa-chevron-up');
    return;
  }
  const item = e.target.closest('.pinned-item');
  if (item) {
    const messageId = item.dataset.messageId;
    const row = document.querySelector(`#messagesList .message-row[data-message-id="${messageId}"]`);
    if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

async function togglePin(messageId, isPinned) {
  const convId = chatState.activeConversationId;
  const result = isPinned
    ? await unpinMessageRequest(convId, messageId)
    : await pinMessageRequest(convId, messageId);
  if (!Array.isArray(result)) {
    alert(result?.message || 'Failed to update pin.');
    return;
  }
  chatState.pinnedMessages = result;
  renderChatPanel();
  scrollMessagesToBottom('auto');
}

function scrollMessagesToBottom(behavior = 'smooth') {
  const list = document.getElementById('messagesList');
  if (!list) return;

  list.scrollTo({
    top: list.scrollHeight,
    behavior,
  });
}

export async function loadMessages(conversationId) {
  chatState.pinnedMessages = [];
  renderChatPanel();
  const [data, pinned] = await Promise.all([
    fetchMessages(conversationId),
    fetchPinnedMessages(conversationId),
  ]);
  chatState.activeMessages = Array.isArray(data) ? data : [];
  chatState.pinnedMessages = Array.isArray(pinned) ? pinned : [];
  renderChatPanel();
  startMessageRefresh();
}

async function refreshMessages() {
  if (!chatState.activeConversationId || chatState.messageRefreshInFlight) return;

  chatState.messageRefreshInFlight = true;
  const conversationId = chatState.activeConversationId;
  const data = await fetchMessages(conversationId);
  chatState.messageRefreshInFlight = false;

  if (conversationId !== chatState.activeConversationId || !Array.isArray(data)) return;

  const oldLastId = chatState.activeMessages.at(-1)?.message_id;
  const newLastId = data.at(-1)?.message_id;
  if (chatState.activeMessages.length === data.length && oldLastId === newLastId) return;

  chatState.activeMessages = data;
  renderMessageList(true);

  const latestMessage = chatState.activeMessages.at(-1);
  const conv = getActiveConversation();
  if (conv && latestMessage) {
    conv.last_message = latestMessage.text
      || (latestMessage.file_type?.startsWith('audio/') ? 'Voice message' : latestMessage.file_name || 'File');
    conv.last_message_at = latestMessage.created_at;
    renderConversationList(loadMessages);
  }
}

function startMessageRefresh() {
  if (chatState.messageRefreshTimer) clearInterval(chatState.messageRefreshTimer);
  chatState.messageRefreshTimer = setInterval(refreshMessages, 2000);
}

async function startVoiceRecording() {
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    alert('Microphone access denied.');
    return;
  }

  voiceChunks = [];
  voiceDiscarded = false;
  voiceRecordingStart = Date.now();
  voiceRecorder = new MediaRecorder(stream);

  voiceRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) voiceChunks.push(e.data);
  };

  voiceRecorder.onstop = () => {
    stream.getTracks().forEach((t) => t.stop());
    if (voiceTimerInterval) {
      clearInterval(voiceTimerInterval);
      voiceTimerInterval = null;
    }
    if (!voiceDiscarded) showVoicePreview();
  };

  voiceRecorder.start();
  showRecordingUI();
}

function showRecordingUI() {
  const form = document.getElementById('messageForm');
  if (!form) return;

  form.innerHTML = `
    <div class="voice-recording-indicator d-flex align-items-center gap-3 flex-grow-1">
      <span class="voice-rec-dot"></span>
      <span class="voice-rec-time" id="voiceTimer">0:00</span>
      <span class="text-muted small">Recording...</span>
    </div>
    <button class="btn btn-danger flex-shrink-0" id="voiceStopBtn" type="button">
      <i class="fas fa-stop me-1"></i>Stop
    </button>
    <button class="btn btn-outline-secondary flex-shrink-0" id="voiceDiscardRecBtn" type="button" title="Discard">
      <i class="fas fa-trash"></i>
    </button>`;

  document.getElementById('voiceStopBtn').addEventListener('click', () => {
    if (voiceRecorder && voiceRecorder.state !== 'inactive') voiceRecorder.stop();
  });

  document.getElementById('voiceDiscardRecBtn').addEventListener('click', () => {
    voiceDiscarded = true;
    if (voiceRecorder && voiceRecorder.state !== 'inactive') voiceRecorder.stop();
    cleanupVoiceState();
    renderChatPanel();
    scrollMessagesToBottom('auto');
  });

  voiceTimerInterval = setInterval(() => {
    const timerEl = document.getElementById('voiceTimer');
    if (!timerEl) {
      clearInterval(voiceTimerInterval);
      return;
    }
    timerEl.textContent = formatDuration(Math.floor((Date.now() - voiceRecordingStart) / 1000));
  }, 1000);
}

function showVoicePreview() {
  const form = document.getElementById('messageForm');
  if (!form) return;

  const duration = Math.round((Date.now() - voiceRecordingStart) / 1000);
  const blob = new Blob(voiceChunks, { type: 'audio/webm' });
  const previewUrl = URL.createObjectURL(blob);

  form.innerHTML = `
    <i class="fas fa-microphone-alt text-primary flex-shrink-0 align-self-center"></i>
    <audio controls src="${previewUrl}" class="msg-audio flex-grow-1"></audio>
    <span class="text-muted small flex-shrink-0 align-self-center">${escapeHtml(formatDuration(duration))}</span>
    <button class="btn btn-primary flex-shrink-0" id="voiceSendBtn" type="button">
      <i class="fas fa-paper-plane"></i>
    </button>
    <button class="btn btn-outline-secondary flex-shrink-0" id="voiceDiscardPreviewBtn" type="button" title="Discard">
      <i class="fas fa-trash"></i>
    </button>`;

  document.getElementById('voiceSendBtn').addEventListener('click', async () => {
    URL.revokeObjectURL(previewUrl);
    voiceRecorder = null;
    voiceChunks = [];

    const result = await uploadVoiceRequest(chatState.activeConversationId, blob, duration);
    if (!result.message_id) {
      alert(result.message || 'Failed to send voice message.');
      renderChatPanel();
      return;
    }

    chatState.activeMessages.push(result);
    const conv = getActiveConversation();
    if (conv) {
      conv.last_message = 'Voice message';
      conv.last_message_at = result.created_at;
    }
    renderConversationList(loadMessages);
    renderChatPanel();
    renderMessageList(true);
  });

  document.getElementById('voiceDiscardPreviewBtn').addEventListener('click', () => {
    URL.revokeObjectURL(previewUrl);
    voiceRecorder = null;
    voiceChunks = [];
    renderChatPanel();
    scrollMessagesToBottom('auto');
  });
}

async function sendActiveFile(file) {
  if (!chatState.activeConversationId) return;

  const result = await uploadFileRequest(chatState.activeConversationId, file);
  if (!result.message_id) {
    alert(result.message || 'Failed to upload file.');
    return;
  }

  chatState.activeMessages.push(result);
  const conv = getActiveConversation();
  if (conv) {
    conv.last_message = result.file_name || 'File';
    conv.last_message_at = result.created_at;
  }
  renderConversationList(loadMessages);
  renderMessageList(true);
}

async function sendActiveMessage(event) {
  event.preventDefault();
  const input = document.getElementById('messageInput');
  const text = input.value.trim();
  if (!text || !chatState.activeConversationId) return;

  input.disabled = true;
  const result = await sendMessageRequest(chatState.activeConversationId, text);
  input.disabled = false;
  input.focus();

  if (!result.message_id) {
    alert(result.message || 'Failed to send message.');
    return;
  }

  input.value = '';
  chatState.activeMessages.push(result);
  const conv = getActiveConversation();
  if (conv) {
    conv.last_message = result.text;
    conv.last_message_at = result.created_at;
  }
  renderConversationList(loadMessages);
  renderMessageList(true);
}
