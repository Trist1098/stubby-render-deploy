/* global auth */

import { chatState } from './chatState.js';

export function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function formatTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  return isToday
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

export function getCurrentUserId() {
  const user = auth.getUser();
  return user?.user_id || user?.id || Number(localStorage.getItem('user_id'));
}

export function getConversationName(conv) {
  if (!conv) return 'Conversation';
  return conv.type === 'friend'
    ? conv.other_username || 'Direct message'
    : conv.name || 'Group Chat';
}

export function getActiveConversation() {
  return chatState.conversations.find(
    (conv) => conv.conversation_id === chatState.activeConversationId,
  );
}
