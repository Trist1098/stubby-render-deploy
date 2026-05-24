/* global auth */

import { fetchConversations } from './chatApi.js';
import { chatState } from './chatState.js';
import { renderConversationList } from './conversations.js';
import { initNewChatModal } from './modal.js';
import { loadMessages, renderEmptyChat } from './messages.js';

async function loadConversations() {
  const data = await fetchConversations();
  chatState.conversations = Array.isArray(data) ? data : [];
  const requestedConversationId = Number(
    new URLSearchParams(window.location.search).get('conversationId'),
  );
  if (
    Number.isInteger(requestedConversationId) &&
    chatState.conversations.some((conversation) => conversation.conversation_id === requestedConversationId)
  ) {
    chatState.activeConversationId = requestedConversationId;
  }
  renderConversationList(loadMessages);
  if (chatState.activeConversationId) await loadMessages(chatState.activeConversationId);
}

if (!auth.isLoggedIn()) {
  window.location.href = 'login.html';
} else {
  renderEmptyChat();
  initNewChatModal(loadConversations);
  loadConversations();
}
