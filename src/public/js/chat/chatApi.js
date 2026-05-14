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
