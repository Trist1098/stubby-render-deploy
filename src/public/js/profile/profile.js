/* global auth, bootstrap, API_URL */

document.addEventListener('DOMContentLoaded', async () => {
  if (typeof auth === 'undefined') {
    console.error('auth is not defined. Ensure js/core/auth.js is loaded.');
    return;
  }

  const userData = auth.getUser();
  const urlParams = new URLSearchParams(window.location.search);
  const friendId = urlParams.get('friendId');
  const userId = userData.user_id;
  const currentUserId = userId;
  const isViewProfilePage = window.location.pathname.endsWith('viewProfile.html');
  let pageUserData = userData;

  const profileNameEl = document.getElementById('profile-name');
  const profileDiplomaEl = document.getElementById('profile-diploma');
  const profileInstitutionEl = document.getElementById('profile-institution');
  const profileAboutEl = document.getElementById('profile-about-text');
  const profileTitleEl = document.getElementById('profile-title');
  const profileFriendsList = document.getElementById('profile-friends-list');
  const profileBadgesList = document.getElementById('profile-badges-list');
  const profileActivitySummary = document.getElementById('profile-activity-summary');
  const profileExperienceList = document.getElementById('profile-experience-list');
  const profileActions = document.querySelector('.profile-action-buttons');
  const connectButton = document.getElementById('profile-connect-button');
  const messageButton = document.getElementById('profile-message-button');
  const friendSearchInput = document.getElementById('friend-search-input');
  const viewAllBadgesBtn = document.getElementById('view-all-badges-btn');
  const allBadgesSearchInput = document.getElementById('all-badges-search-input');
  const allBadgesCategoryFilter = document.getElementById('all-badges-category-filter');
  const allBadgesStatusFilter = document.getElementById('all-badges-status-filter');
  const allBadgesResetBtn = document.getElementById('all-badges-reset-btn');
  const allBadgesList = document.getElementById('all-badges-list');
  const activityMatchModalEl = document.getElementById('activityMatchModal');
  const activityMatchContent = document.getElementById('activity-match-content');
  const experienceModalEl = document.getElementById('experienceModal');
  const experienceModalLabel = document.getElementById('experienceModalLabel');
  const experienceForm = document.getElementById('experience-form');
  const addExperienceButton = document.getElementById('add-experience-button');
  const experienceTypeInput = document.getElementById('experience-type');
  const experienceTitleInput = document.getElementById('experience-title');
  const experienceOrganizationInput = document.getElementById('experience-organization');
  const experienceStartDateInput = document.getElementById('experience-start-date');
  const experienceEndDateInput = document.getElementById('experience-end-date');
  const experienceDescriptionInput = document.getElementById('experience-description');
  const experienceFormFeedback = document.getElementById('experience-form-feedback');
  const badgeDetailsModalEl = document.getElementById('badgeDetailsModal');
  const allBadgesModalEl = document.getElementById('allBadgesModal');
  const badgeDetailName = document.getElementById('badge-detail-name');
  const badgeDetailCategory = document.getElementById('badge-detail-category');
  const badgeDetailDescription = document.getElementById('badge-detail-description');
  const badgeDetailEarned = document.getElementById('badge-detail-earned');
  const badgeDetailIcon = document.getElementById('badge-detail-icon');
  const profilePictureContainer = document.querySelector('.profile-picture');
  const profileBannerContainer = document.querySelector('.profile-banner');
  const profileUploadButton = document.getElementById('profile-upload-button');
  const profileUploadInput = document.getElementById('profile-upload-input');
  const bannerUploadButton = document.getElementById('banner-upload-button');
  const bannerUploadInput = document.getElementById('banner-upload-input');
  const profileFeedback = document.getElementById('profile-feedback');
  const studentSearchInput = document.getElementById('student-search-input');
  const studentSearchResults = document.getElementById('student-search-results');
  const profileVisibleContent = document.getElementById('profile-visible-content');
  const privateProfileModalEl = document.getElementById('privateProfileModal');
  const privateProfileModal = privateProfileModalEl
    ? bootstrap.Modal.getOrCreateInstance(privateProfileModalEl)
    : null;

  const profileSettingsModalEl = document.getElementById('profileSettingsModal');
  const profileSettingsForm = document.getElementById('profile-settings-form');
  const settingsNameInput = document.getElementById('settings-name');
  const settingsEmailInput = document.getElementById('settings-email');
  const openPasswordModalBtn = document.getElementById('open-password-modal-btn');
  const passwordSettingsModalEl = document.getElementById('passwordSettingsModal');
  const passwordSettingsForm = document.getElementById('password-settings-form');
  const settingsCurrentPasswordInput = document.getElementById('settings-current-password');
  const settingsNewPasswordInput = document.getElementById('settings-new-password');
  const settingsConfirmPasswordInput = document.getElementById('settings-confirm-password');
  const passwordSaveFeedback = document.getElementById('password-save-feedback');
  const settingsPersonalInfoInput = document.getElementById('settings-personal-info');
  const settingsYearInput = document.getElementById('settings-year');
  const settingsInstitutionSelect = document.getElementById('settings-institution');
  const settingsDiplomaSelect = document.getElementById('settings-diploma');
  const settingsThemeSelect = document.getElementById('settings-theme');
  const settingsLanguageSelect = document.getElementById('settings-language');
  const settingsPrivateToggle = document.getElementById('settings-private-profile');
  const settingsSaveFeedback = document.getElementById('settings-save-feedback');
  const settingsModal = profileSettingsModalEl
    ? bootstrap.Modal.getOrCreateInstance(profileSettingsModalEl)
    : null;
  const passwordSettingsModal = passwordSettingsModalEl
    ? bootstrap.Modal.getOrCreateInstance(passwordSettingsModalEl)
    : null;
  const activityMatchModal = activityMatchModalEl
    ? bootstrap.Modal.getOrCreateInstance(activityMatchModalEl)
    : null;
  const experienceModal = experienceModalEl
    ? bootstrap.Modal.getOrCreateInstance(experienceModalEl)
    : null;
  const badgeDetailsModal = badgeDetailsModalEl
    ? bootstrap.Modal.getOrCreateInstance(badgeDetailsModalEl)
    : null;
  const allBadgesModal = allBadgesModalEl
    ? bootstrap.Modal.getOrCreateInstance(allBadgesModalEl)
    : null;
  const imageEditorModalEl = document.getElementById('imageEditorModal');
  const imageEditorModal = imageEditorModalEl
    ? bootstrap.Modal.getOrCreateInstance(imageEditorModalEl)
    : null;
  const imageEditorTitle = document.getElementById('imageEditorModalLabel');
  const imageEditorCanvas = document.getElementById('image-editor-canvas');
  const imageEditorFeedback = document.getElementById('image-editor-feedback');
  const imageEditorSaveButton = document.getElementById('image-editor-save');
  const imageEditorResetButton = document.getElementById('image-editor-reset');
  const imageEditorInputs = {
    zoom: document.getElementById('image-editor-zoom'),
    horizontal: document.getElementById('image-editor-horizontal'),
    vertical: document.getElementById('image-editor-vertical'),
    brightness: document.getElementById('image-editor-brightness'),
    contrast: document.getElementById('image-editor-contrast'),
    rotation: document.getElementById('image-editor-rotation'),
  };
  const imageEditorValues = {
    zoom: document.getElementById('image-editor-zoom-value'),
    horizontal: document.getElementById('image-editor-horizontal-value'),
    vertical: document.getElementById('image-editor-vertical-value'),
    brightness: document.getElementById('image-editor-brightness-value'),
    contrast: document.getElementById('image-editor-contrast-value'),
    rotation: document.getElementById('image-editor-rotation-value'),
  };

  const profileAboutInstitutionEl = document.getElementById('profile-about-institution');
  const profileAboutDiplomaEl = document.getElementById('profile-about-diploma');
  const profileAboutYearEl = document.getElementById('profile-about-year');
  const SETTINGS_STORAGE_KEY = 'stubbyProfileSettings';
  const PROFILE_MEDIA_CONFIG = {
    avatar: {
      title: 'Edit profile picture',
      endpoint: '/api/users/profile-picture',
      fieldName: 'profilePic',
      responseField: 'profile_pic',
      width: 480,
      height: 480,
      successMessage: 'Profile picture updated.',
    },
    banner: {
      title: 'Edit profile banner',
      endpoint: '/api/users/profile-banner',
      fieldName: 'profileBanner',
      responseField: 'profile_banner',
      width: 1200,
      height: 420,
      successMessage: 'Profile banner updated.',
    },
  };
  let imageEditorState = null;

  const escapeHtml = (value) => {
    const div = document.createElement('div');
    div.textContent = value || '';
    return div.innerHTML;
  };

  const showFeedback = (message, type = 'success') => {
    if (!profileFeedback) return;
    profileFeedback.textContent = message;
    profileFeedback.className = `profile-feedback-alert show ${type}`;

    setTimeout(() => {
      profileFeedback.classList.remove('show');
    }, 3200);
  };

  const applyTheme = (theme) => {
    if (theme === 'Dark') {
      document.body.classList.add('theme-dark');
    } else {
      document.body.classList.remove('theme-dark');
    }
  };

  const loadProfileSettings = () => {
    const storedValue = localStorage.getItem(SETTINGS_STORAGE_KEY);
    const stored = storedValue ? JSON.parse(storedValue) : {};

    return {
      name: userData?.name || '',
      email: userData?.email || '',
      personalInfo: userData?.profile_text || userData?.bio || '',
      year: userData?.year || 1,
      institutionId: userData?.institution_id || '',
      diplomaId: userData?.diploma_id || '',
      theme: userData?.theme || stored.theme || 'Light',
      language: userData?.language || stored.language || 'English',
      privateProfile: userData?.is_private || stored.privateProfile || false,
      ...stored,
    };
  };

  const populateProfileSettings = (settings) => {
    if (settingsNameInput) settingsNameInput.value = settings.name || '';
    if (settingsEmailInput) settingsEmailInput.value = settings.email || '';
    if (settingsPersonalInfoInput) settingsPersonalInfoInput.value = settings.personalInfo || '';
    if (settingsYearInput) settingsYearInput.value = settings.year || 1;
    if (settingsInstitutionSelect) {
      settingsInstitutionSelect.value = settings.institutionId || '';
      if (window.dropDownHelpers) {
        window.dropDownHelpers.updateDiplomasDropdown(settings.institutionId);
      }
    }
    if (settingsDiplomaSelect) {
      settingsDiplomaSelect.value = settings.diplomaId || '';
    }
    if (settingsThemeSelect) settingsThemeSelect.value = settings.theme || 'Light';
    if (settingsLanguageSelect) settingsLanguageSelect.value = settings.language || 'English';
    if (settingsPrivateToggle) settingsPrivateToggle.checked = !!settings.privateProfile;
    applyTheme(settings.theme);
  };

  const saveProfileSettings = (settings) => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    applyTheme(settings.theme);
  };

  const updateProfileUI = async (userObj) => {
    const name = userObj?.name || 'User';
    const username = userObj?.username || 'user';
    if (profileNameEl) {
      profileNameEl.innerHTML = `${name} <small class="text-secondary">(${username})</small>`;
    }

    if (profileAboutEl) {
      profileAboutEl.innerText = userObj?.profile_text || 'No profile text available.';
    }

    if (profileAboutYearEl) {
      profileAboutYearEl.textContent = `Year ${userObj?.year || 1}`;
    }

    const dipId = userObj?.diploma_id;
    let diplomaName = 'No diploma selected';
    if (dipId) {
      const diplomaData = await fetchJson(`/api/diploma/${dipId}`);
      const diploma = Array.isArray(diplomaData) ? diplomaData[0] : diplomaData;
      diplomaName = diploma?.name || 'No diploma selected';
    }
    if (profileDiplomaEl) profileDiplomaEl.textContent = diplomaName;
    if (profileAboutDiplomaEl) profileAboutDiplomaEl.textContent = diplomaName;

    const instId = userObj?.institution_id;
    let instName = 'No institution selected';
    if (instId) {
      const institutionData = await fetchJson(`/api/institution/${instId}`);
      const institution = Array.isArray(institutionData) ? institutionData[0] : institutionData;
      instName = institution?.name || 'No institution selected';
    }
    if (profileInstitutionEl) profileInstitutionEl.textContent = instName;
    if (profileAboutInstitutionEl) profileAboutInstitutionEl.textContent = instName;
  };

  let allInstitutions = [];
  let allDiplomas = [];

  const loadInstitutionsAndDiplomas = async () => {
    allInstitutions = (await fetchJson('/api/institution')) || [];
    allDiplomas = (await fetchJson('/api/diploma')) || [];

    if (settingsInstitutionSelect) {
      settingsInstitutionSelect.innerHTML = '<option value="">Select Institution</option>';
      allInstitutions.forEach((inst) => {
        const opt = document.createElement('option');
        opt.value = inst.institution_id;
        opt.textContent = inst.name;
        settingsInstitutionSelect.appendChild(opt);
      });
    }

    const updateDiplomasDropdown = (selectedInstId) => {
      if (!settingsDiplomaSelect) return;
      settingsDiplomaSelect.innerHTML = '<option value="">Select Diploma</option>';

      const filteredDiplomas = selectedInstId
        ? allDiplomas.filter((dip) => dip.institution_id.toString() === selectedInstId.toString())
        : allDiplomas;

      filteredDiplomas.forEach((dip) => {
        const opt = document.createElement('option');
        opt.value = dip.diploma_id;
        opt.textContent = dip.name;
        settingsDiplomaSelect.appendChild(opt);
      });
    };

    if (settingsInstitutionSelect) {
      settingsInstitutionSelect.addEventListener('change', (e) => {
        updateDiplomasDropdown(e.target.value);
      });
    }

    return { updateDiplomasDropdown };
  };

  if (profileSettingsForm) {
    profileSettingsForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const newSettings = {
        name: settingsNameInput?.value?.trim() || userData?.name || '',
        email: settingsEmailInput?.value?.trim() || userData?.email || '',
        personalInfo: settingsPersonalInfoInput?.value?.trim() || '',
        year: settingsYearInput?.value || 1,
        institutionId: settingsInstitutionSelect?.value || '',
        diplomaId: settingsDiplomaSelect?.value || '',
        theme: settingsThemeSelect?.value || 'Light',
        language: settingsLanguageSelect?.value || 'English',
        privateProfile: settingsPrivateToggle?.checked || false,
      };

      // Call backend update API for all fields
      try {
        const response = await fetch(`${API_URL}/api/users/update-profile`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...requestHeaders,
          },
          body: JSON.stringify({
            name: newSettings.name,
            email: newSettings.email,
            institutionId: newSettings.institutionId || null,
            diplomaId: newSettings.diplomaId || null,
            year: parseInt(newSettings.year) || 1,
            profileText: newSettings.personalInfo,
            theme: newSettings.theme,
            language: newSettings.language,
            isPrivate: newSettings.privateProfile,
          }),
        });

        if (!response.ok) {
          const errData = await response.json();
          showFeedback(errData.error || 'Failed to update profile settings.', 'error');
          return;
        }

        const result = await response.json();
        if (result?.user) {
          // Update auth local user
          auth.setUser(result.user);
          // Update global userData so subsequent actions use the fresh data
          userData.name = result.user.name;
          userData.email = result.user.email;
          userData.year = result.user.year;
          userData.institution_id = result.user.institution_id;
          userData.diploma_id = result.user.diploma_id;
          userData.profile_text = result.user.profile_text;

          // Dispatch custom event to let navbar know to re-render
          window.dispatchEvent(new Event('userUpdated'));

          // Dynamically update UI on profile page
          await updateProfileUI(result.user);
        }
      } catch (err) {
        console.error('Error updating settings:', err);
        showFeedback('Network error updating settings.', 'error');
        return;
      }

      saveProfileSettings(newSettings);
      if (settingsSaveFeedback) {
        settingsSaveFeedback.textContent = 'Settings saved';
      }

      setTimeout(() => {
        if (settingsSaveFeedback) settingsSaveFeedback.textContent = '';
      }, 2200);

      settingsModal?.hide();
      showFeedback('Profile settings saved.');
    });
  }

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
        const response = await fetch(`${API_URL}/api/users/change-password`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...requestHeaders,
          },
          body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
        });

        const result = await response.json();
        if (!response.ok) {
          if (passwordSaveFeedback) {
            passwordSaveFeedback.textContent =
              result.error || result.message || 'Unable to change password.';
          }
          return;
        }

        passwordSettingsForm.reset();
        passwordSettingsModal?.hide();
        showFeedback('Password changed.');
      } catch (error) {
        console.error('Error changing password:', error);
        if (passwordSaveFeedback) passwordSaveFeedback.textContent = 'Network error.';
      }
    });
  }

  const token = auth.getToken();
  const requestHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const setProfilePicture = (url) => {
    if (!profilePictureContainer) return;
    if (url) {
      profilePictureContainer.style.backgroundImage = `url('${url}')`;
      profilePictureContainer.style.backgroundSize = 'cover';
      profilePictureContainer.style.backgroundPosition = 'center';
    } else {
      profilePictureContainer.style.backgroundImage = '';
    }
  };

  const setProfileBanner = (url) => {
    if (!profileBannerContainer) return;
    profileBannerContainer.style.backgroundImage = url ? `url('${url}')` : '';
  };

  const getEditorValue = (name) => Number(imageEditorInputs[name]?.value || 0);

  const formatPositionValue = (value) => {
    if (value === 0) return 'Center';
    return `${Math.abs(value)}% ${value < 0 ? 'left' : 'right'}`;
  };

  const updateImageEditorLabels = () => {
    if (!imageEditorValues.zoom) return;
    imageEditorValues.zoom.textContent = `${getEditorValue('zoom')}%`;
    imageEditorValues.horizontal.textContent = formatPositionValue(getEditorValue('horizontal'));
    const vertical = getEditorValue('vertical');
    imageEditorValues.vertical.textContent =
      vertical === 0 ? 'Center' : `${Math.abs(vertical)}% ${vertical < 0 ? 'up' : 'down'}`;
    imageEditorValues.brightness.textContent = `${getEditorValue('brightness')}%`;
    imageEditorValues.contrast.textContent = `${getEditorValue('contrast')}%`;
    imageEditorValues.rotation.textContent = `${getEditorValue('rotation')} deg`;
  };

  const resetImageEditor = () => {
    const defaults = {
      zoom: 100,
      horizontal: 0,
      vertical: 0,
      brightness: 100,
      contrast: 100,
      rotation: 0,
    };
    Object.entries(defaults).forEach(([key, value]) => {
      if (imageEditorInputs[key]) imageEditorInputs[key].value = value;
    });
    updateImageEditorLabels();
  };

  const renderEditedImage = () => {
    if (!imageEditorState || !imageEditorCanvas) return;
    const { image, type } = imageEditorState;
    const config = PROFILE_MEDIA_CONFIG[type];
    const context = imageEditorCanvas.getContext('2d');
    const angle = (getEditorValue('rotation') * Math.PI) / 180;
    const rotatedWidth =
      Math.abs(config.width * Math.cos(angle)) + Math.abs(config.height * Math.sin(angle));
    const rotatedHeight =
      Math.abs(config.width * Math.sin(angle)) + Math.abs(config.height * Math.cos(angle));
    const scale =
      Math.max(rotatedWidth / image.naturalWidth, rotatedHeight / image.naturalHeight) *
      (getEditorValue('zoom') / 100);

    imageEditorCanvas.width = config.width;
    imageEditorCanvas.height = config.height;
    context.clearRect(0, 0, config.width, config.height);
    context.save();
    context.filter = `brightness(${getEditorValue('brightness')}%) contrast(${getEditorValue('contrast')}%)`;
    context.translate(
      config.width / 2 + (getEditorValue('horizontal') / 100) * config.width * 0.28,
      config.height / 2 + (getEditorValue('vertical') / 100) * config.height * 0.28,
    );
    context.rotate(angle);
    context.drawImage(
      image,
      (-image.naturalWidth * scale) / 2,
      (-image.naturalHeight * scale) / 2,
      image.naturalWidth * scale,
      image.naturalHeight * scale,
    );
    context.restore();
  };

  const openImageEditor = (file, type) => {
    if (!file || !imageEditorModal || !imageEditorCanvas) return;
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      showFeedback('Choose a JPEG, PNG, or WebP image.', 'error');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      imageEditorState = { image, type };
      if (imageEditorTitle) imageEditorTitle.textContent = PROFILE_MEDIA_CONFIG[type].title;
      if (imageEditorFeedback) imageEditorFeedback.textContent = '';
      resetImageEditor();
      renderEditedImage();
      imageEditorModal.show();
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      showFeedback('Unable to read this image.', 'error');
    };
    image.src = objectUrl;
  };

  const canvasToBlob = () =>
    new Promise((resolve) => {
      imageEditorCanvas.toBlob(resolve, 'image/jpeg', 0.92);
    });

  const uploadEditedImage = async () => {
    if (!imageEditorState || !imageEditorCanvas) return;
    const config = PROFILE_MEDIA_CONFIG[imageEditorState.type];
    const blob = await canvasToBlob();
    if (!blob) {
      if (imageEditorFeedback) imageEditorFeedback.textContent = 'Unable to prepare image.';
      return;
    }

    const formData = new FormData();
    formData.append(config.fieldName, blob, `${imageEditorState.type}.jpg`);
    if (imageEditorSaveButton) {
      imageEditorSaveButton.disabled = true;
      imageEditorSaveButton.textContent = 'Uploading...';
    }

    try {
      const response = await fetch(`${API_URL}${config.endpoint}`, {
        method: 'POST',
        headers: {
          ...requestHeaders,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        if (imageEditorFeedback) {
          imageEditorFeedback.textContent = errorData?.error || 'Unable to upload image.';
        }
        return;
      }

      const result = await response.json();
      if (result?.[config.responseField]) {
        if (imageEditorState.type === 'avatar') {
          setProfilePicture(result.profile_pic);
        } else {
          setProfileBanner(result.profile_banner);
        }
        const updatedUser = result.user || {
          ...userData,
          [config.responseField]: result[config.responseField],
        };
        Object.assign(userData, updatedUser);
        auth.setUser(updatedUser);
        imageEditorModal.hide();
        showFeedback(config.successMessage);
      }
    } catch (error) {
      console.error('Profile media upload error', error);
      if (imageEditorFeedback) imageEditorFeedback.textContent = 'Unable to upload image.';
    } finally {
      if (imageEditorSaveButton) {
        imageEditorSaveButton.disabled = false;
        imageEditorSaveButton.textContent = 'Save image';
      }
    }
  };

  const onProfileImageSelected = () => {
    const file = profileUploadInput?.files?.[0];
    openImageEditor(file, 'avatar');
    if (profileUploadInput) profileUploadInput.value = '';
  };

  const onBannerImageSelected = () => {
    const file = bannerUploadInput?.files?.[0];
    openImageEditor(file, 'banner');
    if (bannerUploadInput) bannerUploadInput.value = '';
  };

  if (profileUploadButton) {
    profileUploadButton.addEventListener('click', () => profileUploadInput?.click());
  }

  if (profileUploadInput) {
    profileUploadInput.addEventListener('change', onProfileImageSelected);
  }

  if (bannerUploadButton) {
    bannerUploadButton.addEventListener('click', () => bannerUploadInput?.click());
  }

  if (bannerUploadInput) {
    bannerUploadInput.addEventListener('change', onBannerImageSelected);
  }

  Object.values(imageEditorInputs).forEach((input) => {
    input?.addEventListener('input', () => {
      updateImageEditorLabels();
      renderEditedImage();
    });
  });

  imageEditorResetButton?.addEventListener('click', () => {
    resetImageEditor();
    renderEditedImage();
  });
  imageEditorSaveButton?.addEventListener('click', uploadEditedImage);

  async function fetchJson(endpoint) {
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...requestHeaders,
        },
      });

      if (!response.ok) {
        console.error(`Failed to fetch ${endpoint}:`, response.status);
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error(`Error fetching ${endpoint}:`, error);
      return null;
    }
  }

  if (isViewProfilePage && friendId) {
    const friendProfile = await fetchJson(`/api/users/viewProfile/${friendId}`);
    if (friendProfile && !friendProfile.error) {
      pageUserData = friendProfile;
    } else {
      console.error('Unable to load friend profile.', friendProfile);
    }
  }

  const pageUserId = pageUserData?.user_id || pageUserData?.id || pageUserData?.userId;
  const isOwnProfile = !friendId || (currentUserId && currentUserId.toString() === friendId);
  if (profileActions && isOwnProfile) {
    profileActions.style.display = 'none';
  }

  if (connectButton && isOwnProfile) {
    connectButton.style.display = 'none';
  }

  if (messageButton && isOwnProfile) {
    messageButton.style.display = 'none';
  }

  if (profileTitleEl) {
    profileTitleEl.textContent = isOwnProfile ? 'My Profile' : 'Friend Profile';
  }

  if (isViewProfilePage && pageUserData?.is_private && !isOwnProfile) {
    if (profileVisibleContent) profileVisibleContent.replaceChildren();
    if (profileActions) profileActions.style.display = 'none';
    privateProfileModal?.show();
    return;
  }

  const formatActivityDate = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  };

  const wasAddedWithinLastSevenDays = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return date >= sevenDaysAgo && date <= new Date();
  };

  const formatTimelineDate = (value) => {
    if (!value) return 'Present';
    const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  };

  const renderActivityItem = (icon, title, detail, matchId = '') => {
    const tag = matchId ? 'button' : 'div';
    const linkAttributes = matchId
      ? ` type="button" data-match-id="${matchId}" class="activity-item activity-item-hover activity-item-link"`
      : ' class="activity-item activity-item-hover"';

    return `
        <${tag}${linkAttributes}>
          <div class="activity-item-icon"><i class="fas ${icon}"></i></div>
          <div>
            <div class="activity-item-title">${escapeHtml(title)}</div>
            <div class="activity-item-detail">${escapeHtml(detail)}</div>
          </div>
        </${tag}>
      `;
  };

  const renderExpandableActivityList = (items, listName) => {
    const visibleItems = items.slice(0, 3).join('');
    const additionalItems = items.slice(3).join('');

    return `
      <div class="activity-list">${visibleItems}</div>
      ${
        additionalItems
          ? `
            <div class="activity-list activity-extra-list d-none" data-activity-extra="${listName}">
              ${additionalItems}
            </div>
            <button
              type="button"
              class="activity-more-button"
              data-activity-toggle="${listName}"
              aria-expanded="false"
            >
              More <i class="fas fa-chevron-down"></i>
            </button>
          `
          : ''
      }
    `;
  };

  const openMatchDetails = async (matchId) => {
    if (!activityMatchModal || !activityMatchContent) return;

    activityMatchContent.innerHTML =
      '<div class="profile-loading-state">Loading match details...</div>';
    activityMatchModal.show();

    const match = await fetchJson(`/api/matches/request/${matchId}`);
    if (!match) {
      activityMatchContent.innerHTML =
        '<div class="profile-empty-state compact"><i class="fas fa-circle-exclamation"></i><span>Unable to load match details.</span></div>';
      return;
    }

    const isReceived = Number(match.receiver_id) === Number(userId);
    const partnerName = isReceived ? match.sender_name : match.receiver_name;
    const partnerInitial = (partnerName || 'S').charAt(0).toUpperCase();
    const [studyDate, studyTime] = (match.time_slot || '').split(' ');

    activityMatchContent.innerHTML = `
      <div class="match-detail-hero">
        <div class="match-detail-avatar">${escapeHtml(partnerInitial)}</div>
        <div class="match-detail-hero-copy">
          <h4 class="fw-bold mb-1">${escapeHtml(partnerName || 'Study partner')}</h4>
          <p class="match-detail-topic">${escapeHtml(match.topic || 'Study Match')}</p>
        </div>
        <span class="match-detail-status">${escapeHtml(match.status || 'Accepted')}</span>
      </div>
      <div class="match-detail-grid">
        <div class="match-detail-field">
          <div class="match-detail-label">Module</div>
          <div class="match-detail-value">${escapeHtml(match.module_code || 'General')}</div>
        </div>
        <div class="match-detail-field">
          <div class="match-detail-label">Session Type</div>
          <div class="match-detail-value">${match.type === 'group' ? 'Group Study' : 'One-on-One'}</div>
        </div>
        <div class="match-detail-field">
          <div class="match-detail-label">Mode</div>
          <div class="match-detail-value">${match.is_online ? 'Online' : 'In Person'}</div>
        </div>
        <div class="match-detail-field">
          <div class="match-detail-label">Date</div>
          <div class="match-detail-value">${escapeHtml(studyDate || 'Not scheduled')}</div>
        </div>
        <div class="match-detail-field">
          <div class="match-detail-label">Time</div>
          <div class="match-detail-value">${escapeHtml(studyTime || 'Not scheduled')}</div>
        </div>
        <div class="match-detail-field">
          <div class="match-detail-label">Location</div>
          <div class="match-detail-value">${escapeHtml(match.location || 'Not specified')}</div>
        </div>
        <div class="match-detail-note">
          <div class="match-detail-label">Study Note</div>
          <div class="match-detail-value">${escapeHtml(match.message || 'No note attached.')}</div>
        </div>
      </div>
    `;
  };

  let profileExperiences = [];
  let editingExperienceId = null;

  const renderExperiences = () => {
    if (!profileExperienceList) return;

    if (profileExperiences.length === 0) {
      profileExperienceList.innerHTML = `
        <div class="profile-empty-state compact">
          <i class="fas fa-briefcase"></i>
          <span>${isOwnProfile ? 'Add academic or work experience to your profile.' : 'No experience shared yet.'}</span>
        </div>
      `;
      return;
    }

    profileExperienceList.innerHTML = `
      <div class="experience-timeline">
        ${profileExperiences
          .map(
            (experience) => `
              <div class="experience-item">
                <div class="experience-dot">
                  <i class="fas ${experience.type === 'work' ? 'fa-briefcase' : 'fa-graduation-cap'}"></i>
                </div>
                <div class="experience-content">
                  <div class="experience-heading">
                    <div>
                      <h6 class="fw-bold mb-1">${escapeHtml(experience.title)}</h6>
                      <div class="experience-organization">${escapeHtml(experience.organization)}</div>
                    </div>
                    ${
                      isOwnProfile
                        ? `
                          <div class="experience-actions">
                            <button type="button" class="experience-action-button edit" data-action="edit-experience" data-experience-id="${experience.experience_id}" aria-label="Edit ${escapeHtml(experience.title)}">
                              <i class="fas fa-pen"></i>
                              <span>Edit</span>
                            </button>
                            <button type="button" class="experience-action-button delete" data-action="delete-experience" data-experience-id="${experience.experience_id}" aria-label="Delete ${escapeHtml(experience.title)}">
                              <i class="fas fa-trash-can"></i>
                              <span>Delete</span>
                            </button>
                          </div>
                        `
                        : ''
                    }
                  </div>
                  <div class="experience-period">
                    ${formatTimelineDate(experience.start_date)} - ${formatTimelineDate(experience.end_date)}
                    <span class="experience-type">${experience.type === 'work' ? 'Work' : 'Academic'}</span>
                  </div>
                  ${experience.description ? `<p class="experience-description">${escapeHtml(experience.description)}</p>` : ''}
                </div>
              </div>
            `,
          )
          .join('')}
      </div>
    `;
  };

  const loadExperiences = async () => {
    if (!profileExperienceList || !pageUserId) return;
    const experiences = await fetchJson(`/api/experiences/${pageUserId}`);
    profileExperiences = Array.isArray(experiences) ? experiences : [];
    renderExperiences();
  };

  const openExperienceForm = (experience = null) => {
    if (!experienceModal || !experienceForm) return;
    editingExperienceId = experience?.experience_id || null;
    experienceForm.reset();
    experienceModalLabel.textContent = editingExperienceId ? 'Edit Experience' : 'Add Experience';
    experienceTypeInput.value = experience?.type || 'academic';
    experienceTitleInput.value = experience?.title || '';
    experienceOrganizationInput.value = experience?.organization || '';
    experienceStartDateInput.value = experience?.start_date?.slice(0, 10) || '';
    experienceEndDateInput.value = experience?.end_date?.slice(0, 10) || '';
    experienceDescriptionInput.value = experience?.description || '';
    experienceFormFeedback.textContent = '';
    experienceModal.show();
  };

  const renderActivityUnavailable = () => {
    profileActivitySummary.innerHTML = `
      <div class="profile-empty-state">
        <i class="fas fa-circle-exclamation"></i>
        <div>
          <h6 class="fw-bold mb-1">Activity unavailable</h6>
          <p class="text-secondary mb-0">Recent profile activity could not be loaded right now.</p>
        </div>
      </div>
    `;
  };

  const loadProfileActivity = async () => {
    if (!profileActivitySummary || !pageUserId) return;

    if (!isOwnProfile) {
      const [friends, matches] = await Promise.all([
        fetchJson(`/api/friends/${pageUserId}`),
        fetchJson(`/api/matches/profile/${pageUserId}`),
      ]);
      if (!Array.isArray(friends) || !Array.isArray(matches)) {
        renderActivityUnavailable();
        return;
      }

      const recentFriends = friends.map((friend) => {
        const addedOn = formatActivityDate(friend.created_at);
        const detail = addedOn ? `Connected ${addedOn}` : 'Study connection';
        return renderActivityItem(
          'fa-user-group',
          friend.name || friend.username || 'Study friend',
          detail,
        );
      });
      const recentMatches = matches.map((match) => {
        const matchedOn = formatActivityDate(match.updated_at);
        const context = match.module_code || match.topic || 'Accepted study match';
        const detail = matchedOn ? `${context} - ${matchedOn}` : context;
        return renderActivityItem(
          'fa-handshake',
          match.name || match.username || 'Study partner',
          detail,
        );
      });

      profileActivitySummary.innerHTML = `
        <div class="activity-stats activity-stats-compact">
          <div class="activity-stat">
            <div class="activity-stat-number">${matches.length}</div>
            <div class="activity-stat-label">Matches</div>
          </div>
          <div class="activity-stat">
            <div class="activity-stat-number">${friends.length}</div>
            <div class="activity-stat-label">Visible friends</div>
          </div>
        </div>
        <div class="activity-section">
          <h6 class="fw-bold mb-2">Recent Study Matches</h6>
          ${
            recentMatches.length > 0
              ? renderExpandableActivityList(recentMatches, 'view-matches')
              : '<div class="activity-section-empty">No study matches to display.</div>'
          }
        </div>
        <div class="activity-section">
          <h6 class="fw-bold mb-2">Recent Connections</h6>
          ${
            recentFriends.length > 0
              ? renderExpandableActivityList(recentFriends, 'view-connections')
              : '<div class="activity-section-empty">No visible connections to display.</div>'
          }
        </div>
      `;
      return;
    }

    const [matches, incomingMatches, outgoingMatches, friends] = await Promise.all([
      fetchJson('/api/matches/active'),
      fetchJson('/api/matches/requests/received'),
      fetchJson('/api/matches/requests/sent'),
      fetchJson('/api/friends'),
    ]);
    if (
      !Array.isArray(matches) ||
      !Array.isArray(incomingMatches) ||
      !Array.isArray(outgoingMatches) ||
      !Array.isArray(friends)
    ) {
      renderActivityUnavailable();
      return;
    }
    const activeMatches = matches;
    const recentConnections = friends.filter((friend) =>
      wasAddedWithinLastSevenDays(friend.created_at),
    );
    const getPendingCount = (requests) =>
      Number(
        requests[0]?.pending_count || requests.filter((match) => match.status === 'Pending').length,
      );
    const pendingIncoming = getPendingCount(incomingMatches);
    const pendingOutgoing = getPendingCount(outgoingMatches);

    let recentMatchesItems = [];
    if (activeMatches.length > 0) {
      recentMatchesItems = activeMatches.map((match) => {
        const matchedOn = formatActivityDate(match.updated_at || match.created_at);
        const detail = matchedOn ? `Match accepted - ${matchedOn}` : 'Accepted study match';
        const requestId = Number(match.request_id);
        return renderActivityItem(
          'fa-handshake',
          match.name || match.username || 'Study partner',
          detail,
          Number.isInteger(requestId) ? requestId : '',
        );
      });
    }

    const recentConnectionItems = recentConnections.map((friend) => {
      const addedOn = formatActivityDate(friend.created_at);
      const detail = addedOn ? `Connected ${addedOn}` : 'New study connection';
      return renderActivityItem(
        'fa-user-group',
        friend.name || friend.username || 'Study friend',
        detail,
      );
    });

    profileActivitySummary.innerHTML = `
      <div class="activity-stats">
        <div class="activity-stat">
          <div class="activity-stat-number">${activeMatches.length}</div>
          <div class="activity-stat-label">Accepted matches</div>
        </div>
        <div class="activity-stat">
          <div class="activity-stat-number">${pendingIncoming}</div>
          <div class="activity-stat-label">Pending incoming</div>
        </div>
        <div class="activity-stat">
          <div class="activity-stat-number">${pendingOutgoing}</div>
          <div class="activity-stat-label">Pending outgoing</div>
        </div>
      </div>
      ${
        recentMatchesItems.length > 0
          ? `<div class="activity-section"><h6 class="fw-bold mb-2">Recent Study Matches</h6>${renderExpandableActivityList(recentMatchesItems, 'matches')}</div>`
          : ''
      }
      <div class="activity-section">
        <h6 class="fw-bold mb-2">Recent Connections <span class="activity-range">Last 7 days</span></h6>
        ${
          recentConnectionItems.length > 0
            ? renderExpandableActivityList(recentConnectionItems, 'connections')
            : '<div class="activity-section-empty">No new connections in the last 7 days.</div>'
        }
      </div>
    `;
  };

  profileActivitySummary?.addEventListener('click', (event) => {
    const toggleButton = event.target.closest('[data-activity-toggle]');
    if (toggleButton) {
      const extraItems = profileActivitySummary.querySelector(
        `[data-activity-extra="${toggleButton.dataset.activityToggle}"]`,
      );
      if (!extraItems) return;

      const isExpanded = toggleButton.getAttribute('aria-expanded') === 'true';
      extraItems.classList.toggle('d-none', isExpanded);
      toggleButton.setAttribute('aria-expanded', String(!isExpanded));
      toggleButton.innerHTML = !isExpanded
        ? 'Less <i class="fas fa-chevron-up"></i>'
        : 'More <i class="fas fa-chevron-down"></i>';
      return;
    }

    const matchItem = event.target.closest('[data-match-id]');
    if (!matchItem) return;
    openMatchDetails(matchItem.dataset.matchId);
  });

  const profilePicUrl = pageUserData?.profile_pic;
  setProfilePicture(profilePicUrl);
  setProfileBanner(pageUserData?.profile_banner);

  window.dropDownHelpers = await loadInstitutionsAndDiplomas();
  const savedProfileSettings = loadProfileSettings();
  populateProfileSettings(savedProfileSettings);

  if (urlParams.get('settings') === 'true') {
    settingsModal?.show();
  }

  if (profileUploadButton) {
    profileUploadButton.style.display =
      !isViewProfilePage &&
      pageUserId &&
      currentUserId &&
      currentUserId.toString() === pageUserId.toString()
        ? 'flex'
        : 'none';
  }

  if (bannerUploadButton) {
    bannerUploadButton.style.display =
      !isViewProfilePage &&
      pageUserId &&
      currentUserId &&
      currentUserId.toString() === pageUserId.toString()
        ? 'block'
        : 'none';
  }

  await updateProfileUI(pageUserData);
  if (profileVisibleContent) profileVisibleContent.hidden = false;
  await loadExperiences();

  const name = pageUserData?.name || 'User';
  const username = pageUserData?.username || 'user';
  if (profileNameEl) {
    profileNameEl.innerHTML = `${name} <small class="text-secondary">(${username})</small>`;
  }

  if (profileAboutEl) {
    profileAboutEl.innerText =
      pageUserData?.profile_text || pageUserData?.bio || 'No profile text available.';
  }

  const diplomaId = pageUserData?.diploma_id;
  if (profileDiplomaEl) {
    if (diplomaId) {
      const diplomaData = await fetchJson(`/api/diploma/${diplomaId}`);
      const diploma = Array.isArray(diplomaData) ? diplomaData[0] : diplomaData;
      profileDiplomaEl.textContent = diploma?.name || 'No diploma selected';
    } else {
      profileDiplomaEl.textContent = 'No diploma selected';
    }
  }

  const institutionId = pageUserData?.institution_id;
  if (profileInstitutionEl) {
    if (institutionId) {
      const institutionData = await fetchJson(`/api/institution/${institutionId}`);
      const institution = Array.isArray(institutionData) ? institutionData[0] : institutionData;
      profileInstitutionEl.textContent = institution?.name || 'No institution selected';
    } else {
      profileInstitutionEl.textContent = 'No institution selected';
    }
  }

  await loadProfileActivity();

  const friendRequestModalElement = document.getElementById('friendRequestModal');
  const friendRequestModalTitle = document.getElementById('friendRequestModalLabel');
  const friendRequestList = document.getElementById('friend-request-list');
  const friendRequestEmpty = document.getElementById('friend-request-empty');
  const incomingRequestsBtn = document.getElementById('incoming-requests-btn');
  const outgoingRequestsBtn = document.getElementById('outgoing-requests-btn');
  const incomingRequestCounts = document.querySelectorAll('[data-incoming-request-count]');
  const friendRequestHint = document.getElementById('friend-request-hint');
  const matchRequestCounts = document.querySelectorAll('[data-match-request-count]');
  const matchRequestHint = document.getElementById('match-request-hint');
  const removeFriendModalElement = document.getElementById('removeFriendModal');
  const removeFriendSuccessModalElement = document.getElementById('removeFriendSuccessModal');
  const removeFriendMessage = document.getElementById('remove-friend-message');
  const removeFriendSuccessMessage = document.getElementById('remove-friend-success-message');
  const confirmRemoveFriendBtn = document.getElementById('confirm-remove-friend-btn');

  const friendRequestModal = friendRequestModalElement
    ? new bootstrap.Modal(friendRequestModalElement)
    : null;
  const removeFriendModal = removeFriendModalElement
    ? new bootstrap.Modal(removeFriendModalElement)
    : null;
  const removeFriendSuccessModal = removeFriendSuccessModalElement
    ? new bootstrap.Modal(removeFriendSuccessModalElement)
    : null;
  let selectedFriendToRemove = null;

  const renderRequests = (type, requests) => {
    if (!friendRequestList || !friendRequestEmpty) return;

    if (!requests || requests.length === 0) {
      friendRequestList.innerHTML = '';
      friendRequestEmpty.textContent =
        type === 'incoming'
          ? 'No incoming friend requests at the moment.'
          : 'No outgoing friend requests at the moment.';
      friendRequestEmpty.style.display = 'block';
      return;
    }

    friendRequestEmpty.style.display = 'none';
    friendRequestList.innerHTML = requests
      .map((request) => {
        const displayName =
          type === 'incoming'
            ? request.sender_name || 'Unknown'
            : request.receiver_name || 'Unknown';
        const displayUsername =
          type === 'incoming'
            ? request.sender_username || 'unknown'
            : request.receiver_username || 'unknown';
        const initials = displayName.charAt(0).toUpperCase();

        const actionButtons =
          type === 'incoming'
            ? `
                    <button class="btn btn-sm btn-success" data-action="accept" data-request-id="${request.request_id}">Accept</button>
                    <button class="btn btn-sm btn-outline-danger" data-action="reject" data-request-id="${request.request_id}">Reject</button>
                `
            : `
                    <button class="btn btn-sm btn-outline-danger" data-action="cancel" data-request-id="${request.request_id}">Cancel</button>
                `;

        return `
                <div class="friend-request-item">
                    <div class="friend-request-main">
                        <div class="friend-request-avatar">${initials}</div>
                        <div class="friend-request-info">
                            <div class="fw-semibold">${displayName}</div>
                            <small>@${displayUsername}</small>
                            <div class="friend-request-date">Requested ${new Date(request.created_at).toLocaleString()}</div>
                        </div>
                    </div>
                    <div class="friend-request-actions">
                        ${actionButtons}
                    </div>
                </div>
            `;
      })
      .join('');
  };

  const requestWithBody = async (endpoint, method = 'GET', body = null) => {
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...requestHeaders,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });

      if (response.status === 204) return { status: 204 };

      const data = await response.json();
      return { status: response.status, data };
    } catch (error) {
      console.error('Profile action API error:', error);
      return { status: 500, data: null };
    }
  };

  const updateIncomingRequestCount = async () => {
    if (!isOwnProfile || !userId || incomingRequestCounts.length === 0) return;

    const response = await requestWithBody(`/api/friendrequest/incoming/${userId}`, 'GET');
    if (response.status < 200 || response.status >= 300 || !Array.isArray(response.data)) return;

    const count = response.data.length;
    incomingRequestCounts.forEach((countElement) => {
      countElement.textContent = count > 99 ? '99+' : String(count);
      countElement.classList.toggle('d-none', count === 0);
      countElement.setAttribute(
        'aria-label',
        `${count} pending incoming friend request${count === 1 ? '' : 's'}`,
      );
    });
    incomingRequestsBtn?.classList.toggle('has-notification', count > 0);
    if (friendRequestHint) {
      friendRequestHint.textContent =
        count > 0
          ? `${count} incoming request${count === 1 ? '' : 's'} waiting for your response.`
          : 'View your pending incoming or outgoing friend requests.';
    }
  };

  const updateIncomingMatchRequestCount = async () => {
    if (!isOwnProfile || matchRequestCounts.length === 0) return;

    const response = await requestWithBody('/api/matches/requests/received', 'GET');
    if (response.status < 200 || response.status >= 300 || !Array.isArray(response.data)) return;

    const count = Number(
      response.data[0]?.pending_count ||
        response.data.filter((request) => request.status === 'Pending').length,
    );
    matchRequestCounts.forEach((countElement) => {
      countElement.textContent = count > 99 ? '99+' : String(count);
      countElement.classList.toggle('d-none', count === 0);
      countElement.setAttribute(
        'aria-label',
        `${count} pending incoming match request${count === 1 ? '' : 's'}`,
      );
    });
    if (matchRequestHint) {
      matchRequestHint.textContent =
        count > 0
          ? `${count} study match request${count === 1 ? '' : 's'} waiting for your response.`
          : 'Review incoming study match requests from other students.';
    }
  };

  await updateIncomingRequestCount();
  await updateIncomingMatchRequestCount();

  addExperienceButton?.addEventListener('click', () => openExperienceForm());

  experienceForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const body = {
      type: experienceTypeInput.value,
      title: experienceTitleInput.value,
      organization: experienceOrganizationInput.value,
      startDate: experienceStartDateInput.value,
      endDate: experienceEndDateInput.value,
      description: experienceDescriptionInput.value,
    };
    const endpoint = editingExperienceId
      ? `/api/experiences/${editingExperienceId}`
      : '/api/experiences';
    const response = await requestWithBody(endpoint, editingExperienceId ? 'PUT' : 'POST', body);

    if (response.status >= 200 && response.status < 300) {
      experienceModal?.hide();
      await loadExperiences();
      showFeedback(editingExperienceId ? 'Experience updated.' : 'Experience added.');
      return;
    }

    experienceFormFeedback.textContent =
      response.data?.message || 'Unable to save experience. Please try again.';
  });

  profileExperienceList?.addEventListener('click', async (event) => {
    const editButton = event.target.closest('button[data-action="edit-experience"]');
    if (editButton) {
      const experience = profileExperiences.find(
        (item) => item.experience_id.toString() === editButton.dataset.experienceId,
      );
      if (experience) openExperienceForm(experience);
      return;
    }

    const deleteButton = event.target.closest('button[data-action="delete-experience"]');
    if (!deleteButton) return;
    if (!window.confirm('Remove this experience from your profile?')) return;

    const response = await requestWithBody(
      `/api/experiences/${deleteButton.dataset.experienceId}`,
      'DELETE',
    );
    if (response.status === 204) {
      await loadExperiences();
      showFeedback('Experience removed.');
      return;
    }
    showFeedback(response.data?.message || 'Unable to remove experience.', 'error');
  });

  const openDirectChat = async (targetUserId, button = null) => {
    const targetId = Number(targetUserId);
    if (!Number.isInteger(targetId) || targetId <= 0 || targetId === Number(userId)) return;

    const originalText = button?.textContent;
    if (button) {
      button.disabled = true;
      button.textContent = 'Opening...';
    }

    const response = await requestWithBody('/api/chats', 'POST', {
      type: 'friend',
      friendId: targetId,
    });

    if (response.data?.conversation_id) {
      window.location.href = 'chat.html';
      return;
    }

    if (button) {
      button.disabled = false;
      button.textContent = originalText || 'Message';
    }
    showFeedback(response.data?.message || 'Unable to open chat.', 'error');
  };

  if (messageButton && !isOwnProfile) {
    messageButton.addEventListener('click', () => openDirectChat(pageUserId, messageButton));
  }

  const setConnectButton = (text, disabled = false) => {
    if (!connectButton) return;
    connectButton.textContent = text;
    connectButton.disabled = disabled;
  };

  const updateConnectButtonState = async () => {
    if (!connectButton || isOwnProfile || !pageUserId || !userId) return;

    const ownFriends = (await fetchJson('/api/friends')) || [];
    const isAlreadyFriend = ownFriends.some(
      (friend) => friend.friend_id?.toString() === pageUserId.toString(),
    );
    if (isAlreadyFriend) {
      setConnectButton('Friends', true);
      return;
    }

    const outgoingRequests = (await fetchJson(`/api/friendrequest/outgoing/${userId}`)) || [];
    const hasOutgoingRequest = outgoingRequests.some(
      (request) => request.receiver_id?.toString() === pageUserId.toString(),
    );
    if (hasOutgoingRequest) {
      setConnectButton('Request Sent', true);
      return;
    }

    const incomingRequests = (await fetchJson(`/api/friendrequest/incoming/${userId}`)) || [];
    const hasIncomingRequest = incomingRequests.some(
      (request) => request.sender_id?.toString() === pageUserId.toString(),
    );
    if (hasIncomingRequest) {
      setConnectButton('Respond in Requests', true);
      return;
    }

    setConnectButton('Add Friend', false);
  };

  const sendFriendRequest = async () => {
    if (!connectButton || isOwnProfile || !pageUserId || !userId) return;

    setConnectButton('Sending...', true);
    const response = await requestWithBody(
      `/api/friendrequest/create/${userId}/${pageUserId}`,
      'POST',
    );

    if (response.status >= 200 && response.status < 300) {
      setConnectButton('Request Sent', true);
      showFeedback('Friend request sent.');
      return;
    }

    const message =
      response.data?.message || response.data?.error || 'Unable to send friend request.';
    showFeedback(message, 'error');
    await updateConnectButtonState();
  };

  const loadFriendRequests = async (type) => {
    if (!userId) return;

    const endpoint =
      type === 'incoming'
        ? `/api/friendrequest/incoming/${userId}`
        : `/api/friendrequest/outgoing/${userId}`;

    const response = await requestWithBody(endpoint, 'GET');
    if (response.status >= 200 && response.status < 300) {
      renderRequests(type, response.data);
      friendRequestModalTitle.textContent =
        type === 'incoming' ? 'Incoming Friend Requests' : 'Outgoing Friend Requests';
      friendRequestModal?.show();
    } else {
      renderRequests(type, []);
      friendRequestModalTitle.textContent = 'Friend Requests';
      friendRequestModal?.show();
    }
  };

  const performRequestAction = async (action, requestId) => {
    if (!userId || !requestId) return;

    let endpoint;
    let method;

    if (action === 'accept') {
      endpoint = `/api/friendrequest/accept/${userId}/${requestId}`;
      method = 'POST';
    } else if (action === 'reject') {
      endpoint = `/api/friendrequest/reject/${userId}/${requestId}`;
      method = 'DELETE';
    } else if (action === 'cancel') {
      endpoint = `/api/friendrequest/${requestId}`;
      method = 'DELETE';
    }

    const response = await requestWithBody(endpoint, method);
    if (response.status >= 200 && response.status < 300) {
      const currentType = friendRequestModalTitle.textContent.toLowerCase().includes('incoming')
        ? 'incoming'
        : 'outgoing';
      await loadFriendRequests(currentType);
      await loadProfileActivity();
      await updateIncomingRequestCount();
      showFeedback('Friend request updated.');
    } else {
      console.error('Failed to update friend request', response.data);
      showFeedback('Unable to complete the request. Please try again.', 'error');
    }
  };

  if (incomingRequestsBtn) {
    incomingRequestsBtn.addEventListener('click', () => loadFriendRequests('incoming'));
  }

  if (outgoingRequestsBtn) {
    outgoingRequestsBtn.addEventListener('click', () => loadFriendRequests('outgoing'));
  }

  if (friendRequestList) {
    friendRequestList.addEventListener('click', async (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;

      const action = button.dataset.action;
      const requestId = button.dataset.requestId;
      await performRequestAction(action, requestId);
    });
  }

  if (connectButton) {
    connectButton.addEventListener('click', sendFriendRequest);
    await updateConnectButtonState();
  }

  if (studentSearchInput && studentSearchResults) {
    let searchTimer = null;
    let discoveryFriends = [];
    let discoveryOutgoing = [];
    let discoveryIncoming = [];

    const loadDiscoveryStatus = async () => {
      discoveryFriends = (await fetchJson('/api/friends')) || [];
      discoveryOutgoing = (await fetchJson(`/api/friendrequest/outgoing/${userId}`)) || [];
      discoveryIncoming = (await fetchJson(`/api/friendrequest/incoming/${userId}`)) || [];
    };

    const getStudentAction = (studentId) => {
      const id = studentId?.toString();
      if (discoveryFriends.some((friend) => friend.friend_id?.toString() === id)) {
        return '<button class="btn btn-sm btn-outline-secondary" disabled>Friends</button>';
      }
      if (discoveryOutgoing.some((request) => request.receiver_id?.toString() === id)) {
        return '<button class="btn btn-sm btn-outline-secondary" disabled>Requested</button>';
      }
      if (discoveryIncoming.some((request) => request.sender_id?.toString() === id)) {
        return '<button class="btn btn-sm btn-outline-secondary" disabled>Pending</button>';
      }
      return `<button class="btn btn-sm btn-primary" data-action="discover-add" data-user-id="${studentId}">Add</button>`;
    };

    const renderDiscoveryResults = (students, query) => {
      if (!query || query.length < 2) {
        studentSearchResults.innerHTML = `
                    <div class="profile-empty-state compact">
                        <i class="fas fa-magnifying-glass"></i>
                        <span>Type at least 2 characters to search.</span>
                    </div>
                `;
        return;
      }

      if (!students || students.length === 0) {
        studentSearchResults.innerHTML = `
                    <div class="profile-empty-state compact">
                        <i class="fas fa-user-slash"></i>
                        <span>No students found.</span>
                    </div>
                `;
        return;
      }

      studentSearchResults.innerHTML = students
        .map((student) => {
          const initials = student.name ? student.name.charAt(0).toUpperCase() : 'U';
          const role =
            [student.diploma_name, student.institution_name].filter(Boolean).join(' • ') ||
            'Profile details not set';
          const avatar = student.profile_pic
            ? `<img src="${escapeHtml(student.profile_pic)}" alt="${escapeHtml(student.name || 'Student')} profile picture">`
            : `<span>${initials}</span>`;
          return `
                    <div class="student-result-item">
                        <div class="student-result-avatar">${avatar}</div>
                        <div class="student-result-details">
                            <div class="student-result-name">${escapeHtml(student.name || 'Student')}</div>
                            <div class="student-result-username">@${escapeHtml(student.username || 'unknown')}</div>
                            <div class="student-result-meta">${escapeHtml(role)}</div>
                        </div>
                        <div class="student-result-actions">
                            <a href="viewProfile.html?friendId=${student.user_id}" class="btn btn-sm btn-white">View</a>
                            ${getStudentAction(student.user_id)}
                        </div>
                    </div>
                `;
        })
        .join('');
    };

    const searchStudents = async () => {
      const query = studentSearchInput.value.trim();
      if (query.length < 2) {
        renderDiscoveryResults([], query);
        return;
      }

      studentSearchResults.innerHTML =
        '<div class="profile-loading-state">Searching students...</div>';
      await loadDiscoveryStatus();
      const students = (await fetchJson(`/api/users/search?q=${encodeURIComponent(query)}`)) || [];
      renderDiscoveryResults(students, query);
    };

    studentSearchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(searchStudents, 300);
    });

    studentSearchResults.addEventListener('click', async (event) => {
      const addButton = event.target.closest('button[data-action="discover-add"]');
      if (!addButton) return;

      const targetUserId = addButton.dataset.userId;
      addButton.disabled = true;
      addButton.textContent = 'Sending...';

      const response = await requestWithBody(
        `/api/friendrequest/create/${userId}/${targetUserId}`,
        'POST',
      );
      if (response.status >= 200 && response.status < 300) {
        addButton.textContent = 'Requested';
        addButton.className = 'btn btn-sm btn-outline-secondary';
        showFeedback('Friend request sent.');
        await updateConnectButtonState();
        return;
      }

      addButton.disabled = false;
      addButton.textContent = 'Add';
      showFeedback(
        response.data?.message || response.data?.error || 'Unable to send friend request.',
        'error',
      );
    });
  }

  if (profileFriendsList) {
    const friendsEndpoint =
      isViewProfilePage && friendId ? `/api/friends/${friendId}` : '/api/friends';

    let friends = (await fetchJson(friendsEndpoint)) || [];
    let friendsExpanded = false;

    const renderFriends = () => {
      const searchTerm = friendSearchInput?.value?.trim().toLowerCase() || '';
      const shownFriends = friends.filter((friend) => {
        const name = friend.name || '';
        const username = friend.username || '';
        return `${name} ${username}`.toLowerCase().includes(searchTerm);
      });

      if (shownFriends.length === 0) {
        profileFriendsList.innerHTML = `
                    <div class="profile-empty-state compact">
                        <i class="fas fa-user-group"></i>
                        <span>No friends found.</span>
                    </div>
                `;
        return;
      }

      const visibleFriends = friendsExpanded ? shownFriends : shownFriends.slice(0, 3);
      const hasMoreFriends = shownFriends.length > 3;

      const friendItems = visibleFriends
        .map((friend) => {
          const initials = friend.name ? friend.name.charAt(0).toUpperCase() : 'U';
          const removeButton = isOwnProfile
            ? `<button type="button" class="connection-action-button remove" data-action="remove-friend" data-friend-id="${friend.friend_id}" aria-label="Remove ${escapeHtml(friend.name || 'friend')}">
                <i class="fas fa-trash-can"></i><span>Remove</span>
              </button>`
            : '';
          const friendMessageButton = isOwnProfile
            ? `<button type="button" class="connection-action-button message" data-action="message-friend" data-friend-id="${friend.friend_id}">
                <i class="fas fa-comment-dots"></i><span>Message</span>
              </button>`
            : '';

          return `
                    <div class="connection-item">
                        <div class="connection-user">
                            <div class="avatar-sm d-flex align-items-center justify-content-center bg-secondary text-white fw-bold">${initials}</div>
                            <div>
                                <div class="fw-semibold">${friend.name || 'Friend'}</div>
                                <small class="text-secondary">@${friend.username || 'unknown'}</small>
                            </div>
                        </div>
                        <div class="connection-actions">
                            <a href="viewProfile.html?friendId=${friend.friend_id}" class="connection-action-button view">
                              <i class="fas fa-user"></i><span>View</span>
                            </a>
                            ${friendMessageButton}
                            ${removeButton}
                        </div>
                    </div>
                `;
        })
        .join('');

      profileFriendsList.innerHTML = `
        ${friendItems}
        ${
          hasMoreFriends
            ? `
              <button type="button" class="activity-more-button friend-more-button" data-action="toggle-friends" aria-expanded="${friendsExpanded}">
                ${friendsExpanded ? 'Less <i class="fas fa-chevron-up"></i>' : 'More <i class="fas fa-chevron-down"></i>'}
              </button>
            `
            : ''
        }
      `;
    };

    renderFriends();

    if (friendSearchInput) {
      friendSearchInput.addEventListener('input', () => {
        friendsExpanded = false;
        renderFriends();
      });
    }

    const removeSelectedFriend = async () => {
      if (!selectedFriendToRemove) return;

      const selectedFriendId = selectedFriendToRemove.friendId;
      if (!selectedFriendId) return;

      if (confirmRemoveFriendBtn) {
        confirmRemoveFriendBtn.disabled = true;
        confirmRemoveFriendBtn.textContent = 'Removing...';
      }

      const response = await requestWithBody(`/api/friends/${selectedFriendId}`, 'DELETE');

      if (confirmRemoveFriendBtn) {
        confirmRemoveFriendBtn.disabled = false;
        confirmRemoveFriendBtn.textContent = 'Remove Friend';
      }

      if (response.status >= 200 && response.status < 300) {
        friends = friends.filter(
          (friend) => friend.friend_id?.toString() !== selectedFriendId.toString(),
        );
        renderFriends();
        await loadProfileActivity();
        removeFriendModal?.hide();
        if (removeFriendSuccessMessage) {
          removeFriendSuccessMessage.textContent = `${selectedFriendToRemove.name} has been removed from your friend list.`;
        }
        selectedFriendToRemove = null;
        removeFriendSuccessModal?.show();
        return;
      }

      showFeedback(
        response.data?.message || response.data?.error || 'Unable to remove friend.',
        'error',
      );
    };

    if (confirmRemoveFriendBtn) {
      confirmRemoveFriendBtn.addEventListener('click', removeSelectedFriend);
    }

    profileFriendsList.addEventListener('click', (event) => {
      const toggleFriendsButton = event.target.closest('button[data-action="toggle-friends"]');
      if (toggleFriendsButton) {
        friendsExpanded = !friendsExpanded;
        renderFriends();
        return;
      }

      const messageFriendButton = event.target.closest('button[data-action="message-friend"]');
      if (messageFriendButton) {
        openDirectChat(messageFriendButton.dataset.friendId, messageFriendButton);
        return;
      }

      const button = event.target.closest('button[data-action="remove-friend"]');
      if (!button) return;

      const selectedFriendId = button.dataset.friendId;
      if (!selectedFriendId) return;

      const selectedFriend = friends.find(
        (friend) => friend.friend_id?.toString() === selectedFriendId.toString(),
      );
      selectedFriendToRemove = {
        friendId: selectedFriendId,
        name: selectedFriend?.name || 'This friend',
      };

      if (removeFriendMessage) {
        removeFriendMessage.textContent = `Are you sure you want to remove ${selectedFriendToRemove.name} from your friend list?`;
      }

      if (removeFriendModal) {
        removeFriendModal.show();
        return;
      }

      removeSelectedFriend();
    });
  }

  if (profileBadgesList) {
    const userBadges = (await fetchJson(`/api/userbadges/${pageUserId}`)) || [];
    const allBadges = (await fetchJson('/api/badge')) || [];
    const earnedBadgeIds = new Set(userBadges.map((badge) => badge.badge_id?.toString()));

    const getBadgeLabel = (badge) =>
      badge?.badge_name || badge?.name || badge?.title || badge?.badge || badge?.id || 'Badge';

    const getBadgeIcon = (badge) => {
      const category = (badge?.category || '').toLowerCase();
      if (category.includes('commitment')) return 'fa-clock';
      if (category.includes('periodic')) return 'fa-calendar-check';
      if (category.includes('elite')) return 'fa-crown';
      if (category.includes('contribution')) return 'fa-hands-helping';
      if (category.includes('first')) return 'fa-star';
      return 'fa-award';
    };

    const formatCategory = (badge) => {
      const category = badge?.category || 'General';
      return category.charAt(0).toUpperCase() + category.slice(1);
    };

    const formatAwardDate = (badge) => {
      if (!badge?.awarded_at) return '';
      const date = new Date(badge.awarded_at);
      if (Number.isNaN(date.getTime())) return '';
      return `Earned on ${date.toLocaleDateString()}`;
    };

    const findBadge = (badgeId) => {
      const id = badgeId?.toString();
      return (
        userBadges.find((badge) => badge.badge_id?.toString() === id) ||
        allBadges.find((badge) => badge.badge_id?.toString() === id)
      );
    };

    const renderBadgeFilters = () => {
      if (!allBadgesCategoryFilter) return;

      const categories = [...new Set(allBadges.map((badge) => formatCategory(badge)))]
        .filter(Boolean)
        .sort((first, second) => first.localeCompare(second));

      allBadgesCategoryFilter.innerHTML = '<option value="">All categories</option>';
      categories.forEach((category) => {
        const option = document.createElement('option');
        option.value = category.toLowerCase();
        option.textContent = category;
        allBadgesCategoryFilter.appendChild(option);
      });
    };

    const openBadgeDetails = (badgeId) => {
      const badge = findBadge(badgeId);
      if (!badge) return;

      const earned = earnedBadgeIds.has(badge.badge_id?.toString());
      const label = getBadgeLabel(badge);

      if (badgeDetailName) badgeDetailName.textContent = label;
      if (badgeDetailCategory) {
        badgeDetailCategory.textContent = `${formatCategory(badge)} badge`;
      }
      if (badgeDetailDescription) {
        badgeDetailDescription.textContent =
          badge.description || 'No description has been added for this badge yet.';
      }
      if (badgeDetailEarned) {
        badgeDetailEarned.textContent = earned
          ? formatAwardDate(badge) || 'This badge has been earned.'
          : 'Unattained.';
        badgeDetailEarned.className = earned
          ? 'badge-earned-text badge-earned mt-3 mb-0'
          : 'badge-earned-text badge-locked mt-3 mb-0';
      }
      if (badgeDetailIcon) {
        badgeDetailIcon.innerHTML = `<i class="fas ${getBadgeIcon(badge)}"></i>`;
        badgeDetailIcon.classList.toggle('badge-locked-icon', !earned);
      }

      badgeDetailsModal?.show();
    };

    const renderOwnedBadges = () => {
      if (!Array.isArray(userBadges) || userBadges.length === 0) {
        profileBadgesList.innerHTML = '<span class="text-secondary">No badges yet.</span>';
        return;
      }

      profileBadgesList.innerHTML = userBadges
        .map((badge) => {
          const label = escapeHtml(getBadgeLabel(badge));
          return `
                        <button class="badge-item" type="button" data-badge-id="${badge.badge_id}">
                            <i class="fas ${getBadgeIcon(badge)} me-1"></i>
                            ${label}
                        </button>
                    `;
        })
        .join('');
    };

    const renderAllBadges = () => {
      if (!allBadgesList) return;

      if (!Array.isArray(allBadges) || allBadges.length === 0) {
        allBadgesList.innerHTML = '<span class="text-secondary">No badges available.</span>';
        return;
      }

      const searchTerm = allBadgesSearchInput?.value?.trim().toLowerCase() || '';
      const selectedCategory = allBadgesCategoryFilter?.value || '';
      const selectedStatus = allBadgesStatusFilter?.value || '';
      const shownBadges = allBadges.filter((badge) => {
        const label = getBadgeLabel(badge);
        const category = formatCategory(badge);
        const description = badge?.description || '';
        const earned = earnedBadgeIds.has(badge.badge_id?.toString());
        const status = earned ? 'obtained' : 'unattained';
        const matchesSearch = `${label} ${category} ${description}`
          .toLowerCase()
          .includes(searchTerm);
        const matchesCategory = !selectedCategory || category.toLowerCase() === selectedCategory;
        const matchesStatus = !selectedStatus || status === selectedStatus;
        return matchesSearch && matchesCategory && matchesStatus;
      });

      if (shownBadges.length === 0) {
        allBadgesList.innerHTML =
          '<span class="text-secondary">No badges match your search.</span>';
        return;
      }

      allBadgesList.innerHTML = shownBadges
        .map((badge) => {
          const earned = earnedBadgeIds.has(badge.badge_id?.toString());
          const label = escapeHtml(getBadgeLabel(badge));
          const description = escapeHtml(badge.description || 'No description yet.');
          const category = escapeHtml(formatCategory(badge));
          const earnedText = earned ? 'Obtained' : 'Unattained';
          const cardClass = earned ? 'all-badge-card' : 'all-badge-card locked';

          return `
                        <button class="${cardClass}" type="button" data-badge-id="${badge.badge_id}">
                            <div class="all-badge-icon">
                                <i class="fas ${getBadgeIcon(badge)}"></i>
                            </div>
                            <div class="all-badge-content">
                                <div class="d-flex align-items-center justify-content-between gap-2">
                                    <h6 class="fw-bold mb-0">${label}</h6>
                                    <span class="all-badge-status">${earnedText}</span>
                                </div>
                                <small class="text-secondary">${category}</small>
                                <p class="text-secondary mb-0">${description}</p>
                            </div>
                        </button>
                    `;
        })
        .join('');
    };

    const resetAllBadgeFilters = () => {
      if (allBadgesSearchInput) allBadgesSearchInput.value = '';
      if (allBadgesCategoryFilter) allBadgesCategoryFilter.value = '';
      if (allBadgesStatusFilter) allBadgesStatusFilter.value = '';
      renderAllBadges();
    };

    renderOwnedBadges();
    renderBadgeFilters();
    renderAllBadges();

    profileBadgesList.addEventListener('click', (event) => {
      const badgeButton = event.target.closest('[data-badge-id]');
      if (!badgeButton) return;
      openBadgeDetails(badgeButton.dataset.badgeId);
    });

    if (allBadgesList) {
      allBadgesList.addEventListener('click', (event) => {
        const badgeButton = event.target.closest('[data-badge-id]');
        if (!badgeButton) return;
        openBadgeDetails(badgeButton.dataset.badgeId);
      });
    }

    if (allBadgesSearchInput) {
      allBadgesSearchInput.addEventListener('input', renderAllBadges);
    }

    if (allBadgesCategoryFilter) {
      allBadgesCategoryFilter.addEventListener('change', renderAllBadges);
    }

    if (allBadgesStatusFilter) {
      allBadgesStatusFilter.addEventListener('change', renderAllBadges);
    }

    if (allBadgesResetBtn) {
      allBadgesResetBtn.addEventListener('click', resetAllBadgeFilters);
    }

    if (viewAllBadgesBtn) {
      viewAllBadgesBtn.addEventListener('click', () => {
        resetAllBadgeFilters();
        allBadgesModal?.show();
      });
    }
  }
});
