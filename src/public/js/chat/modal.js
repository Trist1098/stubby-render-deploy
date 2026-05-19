/* global bootstrap */

import { createConversation, fetchFriends } from './chatApi.js';
import { chatState } from './chatState.js';
import { renderConversationList } from './conversations.js';
import { loadMessages } from './messages.js';

let newChatModal;

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

async function loadFriends() {
  const data = await fetchFriends();
  chatState.friendsList = Array.isArray(data) ? data : [];

  const sel = document.getElementById('friendSelect');
  if (chatState.friendsList.length === 0) {
    sel.innerHTML = '<option value="" disabled selected>No friends yet</option>';
  } else {
    sel.innerHTML =
      '<option value="" disabled selected>Choose a friend...</option>' +
      chatState.friendsList
        .map((f) => `<option value="${f.user_id}">${f.username}</option>`)
        .join('');
  }

  const box = document.getElementById('friendCheckboxList');
  if (chatState.friendsList.length === 0) {
    box.innerHTML = '<span class="text-muted small">No friends to add</span>';
  } else {
    box.innerHTML = chatState.friendsList
      .map(
        (f) => `
      <div class="form-check">
        <input class="form-check-input" type="checkbox" value="${f.user_id}" id="fc_${f.user_id}">
        <label class="form-check-label small" for="fc_${f.user_id}">${f.username}</label>
      </div>`,
      )
      .join('');
  }
}

function bindChatTypeToggle() {
  document.querySelectorAll('input[name="chatType"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      const isGroup = radio.value === 'group';
      document.getElementById('groupNameField').classList.toggle('d-none', !isGroup);
      document.getElementById('groupMembersField').classList.toggle('d-none', !isGroup);
      document.getElementById('friendSelectField').classList.toggle('d-none', isGroup);
      clearModalError();
    });
  });
}

function bindOpenModal() {
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
}

function bindCreateConversation(loadConversations) {
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
      payload = { type: 'group', name, memberIds: checked.map((c) => Number(c.value)) };
    }

    setCreateLoading(true);
    const result = await createConversation(payload);
    setCreateLoading(false);

    if (result.conversation_id) {
      newChatModal.hide();
      await loadConversations();
      chatState.activeConversationId = result.conversation_id;
      renderConversationList(loadMessages);
      await loadMessages(chatState.activeConversationId);
    } else {
      showModalError(result.message || 'Failed to create conversation.');
    }
  });
}

export function initNewChatModal(loadConversations) {
  newChatModal = new bootstrap.Modal(document.getElementById('newChatModal'));
  bindChatTypeToggle();
  bindOpenModal();
  bindCreateConversation(loadConversations);
}
