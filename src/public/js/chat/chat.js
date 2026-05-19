/* global auth */

import { fetchConversations } from './chatApi.js';
import { chatState } from './chatState.js';
import { renderConversationList } from './conversations.js';
import { initNewChatModal } from './modal.js';
import { loadMessages, renderEmptyChat } from './messages.js';

async function loadConversations() {
  const data = await fetchConversations();
  chatState.conversations = Array.isArray(data) ? data : [];
  renderConversationList(loadMessages);
}

if (!auth.isLoggedIn()) {
  window.location.href = 'login.html';
} else {
  renderEmptyChat();
  initNewChatModal(loadConversations);
  loadConversations();
}
