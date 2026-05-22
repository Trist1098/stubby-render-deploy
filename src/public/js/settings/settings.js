/* global auth, bootstrap, API_URL */

document.addEventListener('DOMContentLoaded', async () => {
  if (!auth.isLoggedIn()) {
    window.location.href = 'login.html';
    return;
  }

  const form = document.getElementById('settings-form');
  const feedback = document.getElementById('settings-feedback');
  const inlineFeedback = document.getElementById('settings-inline-feedback');
  const nameInput = document.getElementById('settings-name');
  const emailInput = document.getElementById('settings-email');
  const openPasswordModalBtn = document.getElementById('open-password-modal-btn');
  const passwordSettingsModalEl = document.getElementById('passwordSettingsModal');
  const passwordSettingsForm = document.getElementById('password-settings-form');
  const settingsCurrentPasswordInput = document.getElementById('settings-current-password');
  const settingsNewPasswordInput = document.getElementById('settings-new-password');
  const settingsConfirmPasswordInput = document.getElementById('settings-confirm-password');
  const passwordSaveFeedback = document.getElementById('password-save-feedback');
  const yearInput = document.getElementById('settings-year');
  const institutionSelect = document.getElementById('settings-institution');
  const diplomaSelect = document.getElementById('settings-diploma');
  const aboutInput = document.getElementById('settings-personal-info');
  const themeToggle = document.getElementById('settings-theme-toggle');
  const languageSelect = document.getElementById('settings-language');
  const defaultPageSelect = document.getElementById('settings-default-page');
  const notificationsToggle = document.getElementById('settings-notifications');
  const privateProfileToggle = document.getElementById('settings-private-profile');
  const friendPrivateToggle = document.getElementById('settings-friend-private');

  const token = auth.getToken();
  let currentUser = auth.getUser() || {};
  let diplomas = [];
  const passwordSettingsModal = passwordSettingsModalEl
    ? bootstrap.Modal.getOrCreateInstance(passwordSettingsModalEl)
    : null;

  const showFeedback = (message, type = 'success') => {
    feedback.textContent = message;
    feedback.className = `profile-feedback-alert show ${type}`;
    setTimeout(() => feedback.classList.remove('show'), 3200);
  };

  const request = async (endpoint, options = {}) => {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || data.message || 'Request failed');
    }
    return data;
  };

  const applyTheme = () => {
    document.body.classList.toggle('theme-dark', themeToggle.checked);
  };

  const fillDiplomas = (institutionId, selectedDiplomaId) => {
    diplomaSelect.innerHTML = '<option value="">Select Diploma</option>';
    const shownDiplomas = institutionId
      ? diplomas.filter((dip) => dip.institution_id?.toString() === institutionId.toString())
      : diplomas;

    shownDiplomas.forEach((diploma) => {
      const option = document.createElement('option');
      option.value = diploma.diploma_id;
      option.textContent = diploma.name;
      diplomaSelect.appendChild(option);
    });

    diplomaSelect.value = selectedDiplomaId || '';
  };

  const fillForm = (user) => {
    nameInput.value = user.name || '';
    emailInput.value = user.email || '';
    yearInput.value = user.year || 1;
    institutionSelect.value = user.institution_id || '';
    fillDiplomas(user.institution_id || '', user.diploma_id || '');
    aboutInput.value = user.profile_text || '';
    themeToggle.checked = user.theme === 'Dark';
    languageSelect.value = user.language || 'English';
    defaultPageSelect.value = user.default_landing_page || 'Dashboard';
    notificationsToggle.checked = user.push_notif !== false;
    privateProfileToggle.checked = user.is_private === true;
    friendPrivateToggle.checked = user.friend_request_private === true;
    applyTheme();
  };

  try {
    const [freshUser, institutionData, diplomaData] = await Promise.all([
      request('/api/users/me'),
      request('/api/institution'),
      request('/api/diploma'),
    ]);

    currentUser = freshUser;
    auth.setUser(freshUser);
    const institutions = institutionData || [];
    diplomas = diplomaData || [];

    institutions.forEach((institution) => {
      const option = document.createElement('option');
      option.value = institution.institution_id;
      option.textContent = institution.name;
      institutionSelect.appendChild(option);
    });

    fillForm(currentUser);
  } catch (error) {
    fillForm(currentUser);
    showFeedback(error.message || 'Unable to load settings.', 'error');
  }

  institutionSelect.addEventListener('change', () => {
    fillDiplomas(institutionSelect.value, '');
  });

  themeToggle.addEventListener('change', applyTheme);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    inlineFeedback.textContent = 'Saving...';

    const payload = {
      name: nameInput.value.trim(),
      email: emailInput.value.trim(),
      year: parseInt(yearInput.value, 10) || 1,
      institutionId: institutionSelect.value || null,
      diplomaId: diplomaSelect.value || null,
      profileText: aboutInput.value.trim(),
      theme: themeToggle.checked ? 'Dark' : 'Light',
      language: languageSelect.value,
      defaultLandingPage: defaultPageSelect.value,
      pushNotif: notificationsToggle.checked,
      isPrivate: privateProfileToggle.checked,
      friendRequestPrivate: friendPrivateToggle.checked,
    };

    try {
      const result = await request('/api/users/update-profile', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      auth.setUser(result.user);
      currentUser = result.user;
      inlineFeedback.textContent = 'Settings saved.';
      window.dispatchEvent(new Event('userUpdated'));
      showFeedback('Settings saved.');
    } catch (error) {
      inlineFeedback.textContent = '';
      showFeedback(error.message || 'Unable to save settings.', 'error');
    }
  });

  if (openPasswordModalBtn && passwordSettingsModal) {
    openPasswordModalBtn.addEventListener('click', () => {
      if (passwordSettingsForm) passwordSettingsForm.reset();
      if (passwordSaveFeedback) passwordSaveFeedback.textContent = '';
      passwordSettingsModal.show();
    });
  }

  if (passwordSettingsForm) {
    passwordSettingsForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const currentPassword = settingsCurrentPasswordInput?.value || '';
      const newPassword = settingsNewPasswordInput?.value || '';
      const confirmPassword = settingsConfirmPasswordInput?.value || '';

      if (!currentPassword || !newPassword || !confirmPassword) {
        if (passwordSaveFeedback) passwordSaveFeedback.textContent = 'Please fill in all fields.';
        return;
      }

      if (newPassword !== confirmPassword) {
        if (passwordSaveFeedback) passwordSaveFeedback.textContent = 'New passwords do not match.';
        return;
      }

      try {
        const result = await request('/api/users/change-password', {
          method: 'PUT',
          body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
        });

        auth.setUser(result.user);
        passwordSettingsForm.reset();
        passwordSettingsModal.hide();
        showFeedback('Password changed.');
      } catch (error) {
        if (passwordSaveFeedback) {
          passwordSaveFeedback.textContent = error.message || 'Unable to change password.';
        }
      }
    });
  }
});
