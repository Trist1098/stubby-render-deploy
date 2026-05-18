import { chatState } from './chatState.js';
import { escapeHtml, formatTime, getConversationName } from './chatUtils.js';

export function renderConversationList(onSelectConversation) {
  const list = document.getElementById('conversationList');
  if (chatState.conversations.length === 0) {
    list.innerHTML =
      '<div class="text-center text-muted py-5 small">No conversations yet.<br>Click <strong>New Chat</strong> to start one.</div>';
    return;
  }

  list.innerHTML = chatState.conversations
    .map((conv) => {
      const displayName = getConversationName(conv);
      const isActive = conv.conversation_id === chatState.activeConversationId;
      return `
      <div class="conv-item d-flex align-items-center gap-3 p-3 border-bottom ${isActive ? 'active' : ''}" data-id="${conv.conversation_id}">
        <div class="conv-avatar">
          <i class="fas ${conv.type === 'group' ? 'fa-users' : 'fa-user'} text-primary"></i>
        </div>
        <div class="flex-grow-1 min-w-0">
          <div class="d-flex justify-content-between align-items-baseline">
            <span class="fw-semibold text-truncate">${escapeHtml(displayName)}</span>
            <span class="text-muted conv-time">${formatTime(conv.last_message_at)}</span>
          </div>
          <div class="text-muted small text-truncate">${escapeHtml(conv.last_message || 'No messages yet')}</div>
        </div>
      </div>`;
    })
    .join('');

  list.querySelectorAll('.conv-item').forEach((item) => {
    item.addEventListener('click', () => {
      chatState.activeConversationId = Number(item.dataset.id);
      renderConversationList(onSelectConversation);
      onSelectConversation(chatState.activeConversationId);
    });
  });
}
