// API helpers and endpoint builders for the study-session page.
// Add the current auth token to requests when the user is logged in.
function authRequestHeaders(headers = {}) {
  const token = window.auth ? window.auth.getToken() : null;
  return token ? { ...headers, Authorization: `Bearer ${token}` } : headers;
}

// Store rotated tokens so long study sessions do not silently fall out of auth.
function saveRotatedToken(response) {
  const nextToken = response.headers.get('X-New-Token');
  if (nextToken && window.auth) window.auth.setToken(nextToken);
}

// If the backend says the session is unauthorized, let the auth module clear the user.
function logoutIfUnauthorized(response) {
  if (response.status === 401 && window.auth) window.auth.logout();
}

// Shared JSON request helper used by most study-session API calls.
async function getJson(url, options = {}) {
  const { headers = {}, ...fetchOptions } = options;
  const response = await fetch(url, {
    ...fetchOptions,
    headers: authRequestHeaders({ 'Content-Type': 'application/json', ...headers }),
  });
  saveRotatedToken(response);
  logoutIfUnauthorized(response);
  const payload = response.status === 204 ? {} : await response.json();
  if (!response.ok) throw new Error(payload.error || 'Request failed');
  return payload.data || payload;
}

// Multipart uploads skip the JSON content type so the browser can set the boundary.
async function postForm(url, formData) {
  const response = await fetch(url, {
    method: 'POST',
    headers: authRequestHeaders(),
    body: formData,
  });
  saveRotatedToken(response);
  logoutIfUnauthorized(response);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'Upload failed');
  return payload.data || payload;
}

// Build the endpoint for running an AI work check on one micro-goal.
function workCheckUrl(goalId) {
  return `${apiBase}/micro-goals/${goalId}/work-check`;
}

// Build the endpoint for showing the past AI checks for a member's goal.
function workCheckHistoryUrl(goalId, userId) {
  return `${apiBase}/micro-goals/${goalId}/work-checks?user_id=${userId}`;
}

// Build the endpoint for the live focus/break/help analytics card.
function focusStatusMixUrl() {
  return `${apiBase}/focus-status-mix`;
}

// Consultation endpoints share the same base, with an optional id when acting on one consultation.
function consultationUrl(consultationId = '') {
  return `${apiBase}/consultations${consultationId ? `/${consultationId}` : ''}`;
}

// Build the endpoint that marks a consultation as finished.
function consultationFinishUrl(consultationId) {
  return `${consultationUrl(consultationId)}/finish`;
}

// Build the endpoint that saves the teacher's direction after a consultation.
function consultationReviewUrl(consultationId) {
  return `${consultationUrl(consultationId)}/review`;
}

// Build the endpoint for the shared whiteboard and scratchpad state.
function consultationWorkspaceUrl(consultationId) {
  return `${consultationUrl(consultationId)}/workspace`;
}

// Build the endpoint that opens a direct session-member chat.
function sessionMemberChatUrl(memberUserId) {
  return `${apiBase}/members/${memberUserId}/chat`;
}
