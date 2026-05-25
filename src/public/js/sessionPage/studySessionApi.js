// API helpers and endpoint builders for the study-session page.
function authRequestHeaders(headers = {}) {
  const token = window.auth ? window.auth.getToken() : null;
  return token ? { ...headers, Authorization: `Bearer ${token}` } : headers;
}

function saveRotatedToken(response) {
  const nextToken = response.headers.get('X-New-Token');
  if (nextToken && window.auth) window.auth.setToken(nextToken);
}

function logoutIfUnauthorized(response) {
  if (response.status === 401 && window.auth) window.auth.logout();
}

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

function workCheckUrl(goalId) {
  return `${apiBase}/micro-goals/${goalId}/work-check`;
}

function workCheckHistoryUrl(goalId, userId) {
  return `${apiBase}/micro-goals/${goalId}/work-checks?user_id=${userId}`;
}

function focusStatusMixUrl() {
  return `${apiBase}/focus-status-mix`;
}

function consultationUrl(consultationId = '') {
  return `${apiBase}/consultations${consultationId ? `/${consultationId}` : ''}`;
}

function consultationFinishUrl(consultationId) {
  return `${consultationUrl(consultationId)}/finish`;
}

function consultationReviewUrl(consultationId) {
  return `${consultationUrl(consultationId)}/review`;
}

function consultationWorkspaceUrl(consultationId) {
  return `${consultationUrl(consultationId)}/workspace`;
}

function sessionMemberChatUrl(memberUserId) {
  return `${apiBase}/members/${memberUserId}/chat`;
}

