if (!auth.isLoggedIn()) {
  window.location.href = 'login.html';
}

const newChatModal = new bootstrap.Modal(document.getElementById('newChatModal'));
let friendsList = [];
let conversations = [];
let activeConversationId = null;

// Helpers

function showModalError(msg) {
  const el = document.getElementById('modalError');
  el.textContent = msg;
  el.classList.remove('d-none');
}

function clearModalError() {
  document.getElementById('modalError').classList.add('d-none');
}

function setCreateLoading(loading) {
  document.getElementById('createBtnText').classList.toggle('d-none', loading);
  document.getElementById('createSpinner').classList.toggle('d-none', !loading);
  document.getElementById('createChatBtn').disabled = loading;
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  return isToday
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

// Conversation list

async function loadConversations() {
  const data = await apiRequest('/api/chats');
  conversations = Array.isArray(data) ? data : [];
  renderConversationList();
}

function renderConversationList() {
  const list = document.getElementById('conversationList');
  if (conversations.length === 0) {
    list.innerHTML = '<div class="text-center text-muted py-5 small">No conversations yet.<br>Click <strong>New Chat</strong> to start one.</div>';
    return;
  }
  list.innerHTML = conversations.map(conv => {
    const displayName = conv.type === 'friend'
      ? (conv.other_username || 'Direct message')
      : (conv.name || 'Group Chat');
    const isActive = conv.conversation_id === activeConversationId;
    return `
      <div class="conv-item d-flex align-items-center gap-3 p-3 border-bottom ${isActive ? 'active' : ''}" data-id="${conv.conversation_id}">
        <div class="conv-avatar">
          <i class="fas ${conv.type === 'group' ? 'fa-users' : 'fa-user'} text-primary"></i>
        </div>
        <div class="flex-grow-1 min-w-0">
          <div class="d-flex justify-content-between align-items-baseline">
            <span class="fw-semibold text-truncate">${displayName}</span>
            <span class="text-muted conv-time">${formatTime(conv.last_message_at)}</span>
          </div>
          <div class="text-muted small text-truncate">${conv.last_message || 'No messages yet'}</div>
        </div>
      </div>`;
  }).join('');

  list.querySelectorAll('.conv-item').forEach(item => {
    item.addEventListener('click', () => {
      activeConversationId = Number(item.dataset.id);
      renderConversationList();
    });
  });
}

// Friends list

async function loadFriends() {
  const data = await apiRequest('/api/chats/friends');
  friendsList = Array.isArray(data) ? data : [];

  const sel = document.getElementById('friendSelect');
  if (friendsList.length === 0) {
    sel.innerHTML = '<option value="" disabled selected>No friends yet</option>';
  } else {
    sel.innerHTML = '<option value="" disabled selected>Choose a friend...</option>' +
      friendsList.map(f => `<option value="${f.user_id}">${f.username}</option>`).join('');
  }

  const box = document.getElementById('friendCheckboxList');
  if (friendsList.length === 0) {
    box.innerHTML = '<span class="text-muted small">No friends to add</span>';
  } else {
    box.innerHTML = friendsList.map(f => `
      <div class="form-check">
        <input class="form-check-input" type="checkbox" value="${f.user_id}" id="fc_${f.user_id}">
        <label class="form-check-label small" for="fc_${f.user_id}">${f.username}</label>
      </div>`).join('');
  }
}

// Chat type toggle

document.querySelectorAll('input[name="chatType"]').forEach(radio => {
  radio.addEventListener('change', () => {
    const isGroup = radio.value === 'group';
    document.getElementById('groupNameField').classList.toggle('d-none', !isGroup);
    document.getElementById('groupMembersField').classList.toggle('d-none', !isGroup);
    document.getElementById('friendSelectField').classList.toggle('d-none', isGroup);
    clearModalError();
  });
});

// Open modal

document.getElementById('newChatBtn').addEventListener('click', () => {
  clearModalError();
  document.getElementById('typeFriend').checked = true;
  document.getElementById('groupNameField').classList.add('d-none');
  document.getElementById('groupMembersField').classList.add('d-none');
  document.getElementById('friendSelectField').classList.remove('d-none');
  document.getElementById('groupName').value = '';
  loadFriends();
  newChatModal.show();
});

// Create conversation

document.getElementById('createChatBtn').addEventListener('click', async () => {
  clearModalError();
  const type = document.querySelector('input[name="chatType"]:checked').value;

  let payload;
  if (type === 'friend') {
    const friendId = document.getElementById('friendSelect').value;
    if (!friendId) return showModalError('Please select a friend.');
    payload = { type: 'friend', friendId: Number(friendId) };
  } else {
    const name = document.getElementById('groupName').value.trim();
    if (!name) return showModalError('Please enter a group name.');
    const checked = [...document.querySelectorAll('#friendCheckboxList input:checked')];
    if (checked.length === 0) return showModalError('Select at least one member.');
    payload = { type: 'group', name, memberIds: checked.map(c => Number(c.value)) };
  }

  setCreateLoading(true);
  const result = await apiRequest('/api/chats', 'POST', payload);
  setCreateLoading(false);

  if (result.conversation_id) {
    newChatModal.hide();
    await loadConversations();
    activeConversationId = result.conversation_id;
    renderConversationList();
  } else {
    showModalError(result.message || 'Failed to create conversation.');
  }
});

// Init

loadConversations();
