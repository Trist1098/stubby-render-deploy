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
