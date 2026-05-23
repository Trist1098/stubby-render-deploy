/* global auth */

import { fetchConversations } from './chatApi.js';
import { chatState } from './chatState.js';
import { renderConversationList, setConvSearch } from './conversations.js';
import { initNewChatModal } from './modal.js';
import { loadMessages, renderEmptyChat } from './messages.js';

async function loadConversations() {
  const data = await fetchConversations();
  chatState.conversations = Array.isArray(data) ? data : [];
  renderConversationList(loadMessages);
}

async function refreshConversations() {
  const data = await fetchConversations();
  if (!Array.isArray(data)) return;
  const changed = data.length !== chatState.conversations.length ||
    data.some((c, i) => c.conversation_id !== chatState.conversations[i]?.conversation_id ||
      c.last_message_at !== chatState.conversations[i]?.last_message_at);
  if (!changed) return;
  chatState.conversations = data;
  renderConversationList(loadMessages);
}

if (!auth.isLoggedIn()) {
  window.location.href = 'login.html';
} else {
  renderEmptyChat();
  initNewChatModal(loadConversations);
  loadConversations();
  setInterval(refreshConversations, 3000);

  const convSearchInput = document.getElementById('convSearchInput');
  if (convSearchInput) {
    convSearchInput.addEventListener('input', (e) => {
      setConvSearch(e.target.value);
      renderConversationList(loadMessages);
    });
  }
}
