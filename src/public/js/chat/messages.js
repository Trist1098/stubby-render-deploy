import { fetchMessages, sendMessageRequest } from './chatApi.js';
import { chatState } from './chatState.js';
import {
  escapeHtml,
  formatTime,
  getActiveConversation,
  getConversationName,
  getCurrentUserId,
} from './chatUtils.js';
import { renderConversationList } from './conversations.js';

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
    <div class="messages-list chat-wallpaper ${chatState.activeWallpaper === 'default' ? '' : chatState.activeWallpaper} flex-grow-1 overflow-auto" id="messagesList">
      ${renderMessages()}
    </div>
    <form class="message-composer d-flex gap-2 p-3 border-top" id="messageForm">
      <input class="form-control" id="messageInput" type="text" placeholder="Type a message" autocomplete="off">
      <button class="btn btn-primary" type="submit">
        <i class="fas fa-paper-plane me-1"></i> Send
      </button>
    </form>`;

  document.getElementById('wallpaperPicker').addEventListener('change', (event) => {
    chatState.activeWallpaper = event.target.value;
    localStorage.setItem('chatWallpaper', chatState.activeWallpaper);
    renderChatPanel();
    scrollMessagesToBottom('auto');
  });

  document.getElementById('messageForm').addEventListener('submit', sendActiveMessage);
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
      return `
      <div class="message-row ${isSent ? 'sent' : 'received'} ${animationClass}">
        <div class="message-bubble">
          <div class="message-meta mb-1">${escapeHtml(message.sender_username)} | ${formatTime(message.created_at)}</div>
          <div>${escapeHtml(message.text)}</div>
        </div>
      </div>`;
    })
    .join('');
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
  renderChatPanel();
  const data = await fetchMessages(conversationId);
  chatState.activeMessages = Array.isArray(data) ? data : [];
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
    conv.last_message = latestMessage.text;
    conv.last_message_at = latestMessage.created_at;
    renderConversationList(loadMessages);
  }
}

function startMessageRefresh() {
  if (chatState.messageRefreshTimer) clearInterval(chatState.messageRefreshTimer);
  chatState.messageRefreshTimer = setInterval(refreshMessages, 2000);
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
