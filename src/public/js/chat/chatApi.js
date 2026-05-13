/* global apiRequest */

export function fetchConversations() {
  return apiRequest('/api/chats');
}

export function fetchFriends() {
  return apiRequest('/api/chats/friends');
}

export function fetchMessages(conversationId) {
  return apiRequest(`/api/chats/${conversationId}/messages`);
}

export function createConversation(payload) {
  return apiRequest('/api/chats', 'POST', payload);
}

export function sendMessageRequest(conversationId, text) {
  return apiRequest(`/api/chats/${conversationId}/messages`, 'POST', { text });
}
