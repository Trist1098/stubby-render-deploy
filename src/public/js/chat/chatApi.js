/* global apiRequest, auth, API_URL */

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

export function editMessageRequest(conversationId, messageId, text) {
  return apiRequest(`/api/chats/${conversationId}/messages/${messageId}`, 'PATCH', { text });
}

export function deleteMessageRequest(conversationId, messageId) {
  return apiRequest(`/api/chats/${conversationId}/messages/${messageId}`, 'DELETE');
}

export function fetchPinnedMessages(conversationId) {
  return apiRequest(`/api/chats/${conversationId}/pinned`);
}

export function pinMessageRequest(conversationId, messageId) {
  return apiRequest(`/api/chats/${conversationId}/messages/${messageId}/pin`, 'POST');
}

export function unpinMessageRequest(conversationId, messageId) {
  return apiRequest(`/api/chats/${conversationId}/messages/${messageId}/pin`, 'DELETE');
}

export function replyToMessageRequest(conversationId, parentMessageId, text) {
  return apiRequest(`/api/chats/${conversationId}/messages/${parentMessageId}/reply`, 'POST', { text });
}

export function addReactionRequest(conversationId, messageId, emoji) {
  return apiRequest(`/api/chats/${conversationId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`, 'POST');
}

export function removeReactionRequest(conversationId, messageId, emoji) {
  return apiRequest(`/api/chats/${conversationId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`, 'DELETE');
}

export async function uploadVoiceRequest(conversationId, audioBlob, duration) {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'voice-message.webm');
  if (duration != null) formData.append('duration', Math.round(duration));
  const token = auth.getToken();
  try {
    const response = await fetch(`${API_URL}/api/chats/${conversationId}/voice`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (response.status === 401) auth.logout();
    return await response.json();
  } catch (err) {
    console.error('API Error:', err);
    return { message: 'Network error' };
  }
}

export async function uploadFileRequest(conversationId, file) {
  const formData = new FormData();
  formData.append('file', file);
  const token = auth.getToken();
  try {
    const response = await fetch(`${API_URL}/api/chats/${conversationId}/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (response.status === 401) auth.logout();
    return await response.json();
  } catch (err) {
    console.error('API Error:', err);
    return { message: 'Network error' };
  }
}

export function sendTypingRequest(conversationId, typing) {
  return apiRequest(`/api/chats/${conversationId}/typing`, 'PUT', { typing });
}

export function fetchTypingUsers(conversationId) {
  return apiRequest(`/api/chats/${conversationId}/typing`);
}

export function searchMessagesRequest(conversationId, params) {
  const qs = new URLSearchParams(params).toString();
  return apiRequest(`/api/chats/${conversationId}/search?${qs}`);
}

export function searchConversationsRequest(q) {
  return apiRequest(`/api/chats/search?q=${encodeURIComponent(q)}`);
}

export function getMentionSuggestionsRequest(conversationId, q) {
  return apiRequest(`/api/chats/${conversationId}/mentions?q=${encodeURIComponent(q)}`);
}

export function markConversationAsRead(conversationId) {
  return apiRequest(`/api/chats/${conversationId}/read`, 'PATCH');
}

export function updateConversationRequest(conversationId, name) {
  return apiRequest(`/api/chats/${conversationId}`, 'PATCH', { name });
}

export function addMemberRequest(conversationId, userId) {
  return apiRequest(`/api/chats/${conversationId}/members`, 'POST', { userId });
}

export function removeMemberRequest(conversationId, userId) {
  return apiRequest(`/api/chats/${conversationId}/members/${userId}`, 'DELETE');
}

export function leaveConversationRequest(conversationId) {
  return apiRequest(`/api/chats/${conversationId}/leave`, 'DELETE');
}

export function fetchConversationDetails(conversationId) {
  return apiRequest(`/api/chats/${conversationId}`);
}
