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

export function formatTimeOnly(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDayLabel(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === now.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
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
