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
    const profileActions = document.querySelector('.profile-action-buttons');
    const profilePictureContainer = document.querySelector('.profile-picture');
    const profileUploadButton = document.getElementById('profile-upload-button');
    const profileUploadInput = document.getElementById('profile-upload-input');

    const profileSettingsModalEl = document.getElementById('profileSettingsModal');
    const profileSettingsForm = document.getElementById('profile-settings-form');
    const settingsNameInput = document.getElementById('settings-name');
    const settingsEmailInput = document.getElementById('settings-email');
    const settingsPasswordInput = document.getElementById('settings-password');
    const settingsPersonalInfoInput = document.getElementById('settings-personal-info');
    const settingsYearInput = document.getElementById('settings-year');
    const settingsInstitutionSelect = document.getElementById('settings-institution');
    const settingsDiplomaSelect = document.getElementById('settings-diploma');
    const settingsThemeSelect = document.getElementById('settings-theme');
    const settingsLanguageSelect = document.getElementById('settings-language');
    const settingsPrivateToggle = document.getElementById('settings-private-profile');
    const settingsSaveFeedback = document.getElementById('settings-save-feedback');
    const settingsModal = profileSettingsModalEl ? bootstrap.Modal.getOrCreateInstance(profileSettingsModalEl) : null;

    const profileAboutInstitutionEl = document.getElementById('profile-about-institution');
    const profileAboutDiplomaEl = document.getElementById('profile-about-diploma');
    const profileAboutYearEl = document.getElementById('profile-about-year');
    const SETTINGS_STORAGE_KEY = 'stubbyProfileSettings';

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
            theme: stored.theme || 'Light',
            language: stored.language || 'English',
            privateProfile: stored.privateProfile || false,
            ...stored,
        };
    };

    const populateProfileSettings = (settings) => {
        if (settingsNameInput) settingsNameInput.value = settings.name || '';
        if (settingsEmailInput) settingsEmailInput.value = settings.email || '';
        if (settingsPasswordInput) settingsPasswordInput.value = '';
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
        allInstitutions = await fetchJson('/api/institution') || [];
        allDiplomas = await fetchJson('/api/diploma') || [];

        if (settingsInstitutionSelect) {
            settingsInstitutionSelect.innerHTML = '<option value="">Select Institution</option>';
            allInstitutions.forEach(inst => {
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
                ? allDiplomas.filter(dip => dip.institution_id.toString() === selectedInstId.toString())
                : allDiplomas;

            filteredDiplomas.forEach(dip => {
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
                password: settingsPasswordInput?.value || '',
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
                        profileText: newSettings.personalInfo
                    })
                });

                if (!response.ok) {
                    const errData = await response.json();
                    alert(errData.error || 'Failed to update profile settings.');
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
                alert('Network error updating settings.');
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
        });
    }

    const token = auth.getToken();
    const requestHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};

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

    const uploadProfileImage = async (file) => {
        if (!file) return;

        const formData = new FormData();
        formData.append('profilePic', file);

        try {
            const response = await fetch(`${API_URL}/api/users/profile-picture`, {
                method: 'POST',
                headers: {
                    ...requestHeaders,
                },
                body: formData,
            });

            if (!response.ok) {
                console.error('Failed to upload profile picture', response.status);
                alert('Unable to upload profile picture.');
                return;
            }

            const result = await response.json();
            if (result?.profile_pic) {
                setProfilePicture(result.profile_pic);
                const updatedUser = result.user || { ...userData, profile_pic: result.profile_pic };
                auth.setUser(updatedUser);
            }
        } catch (error) {
            console.error('Upload error', error);
            alert('Unable to upload profile picture.');
        }
    };

    const onProfileImageSelected = async () => {
        const file = profileUploadInput?.files?.[0];
        if (!file) return;
        await uploadProfileImage(file);
    };

    if (profileUploadButton) {
        profileUploadButton.addEventListener('click', () => profileUploadInput?.click());
    }

    if (profileUploadInput) {
        profileUploadInput.addEventListener('change', onProfileImageSelected);
    }

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

    if (profileTitleEl) {
        profileTitleEl.textContent = isOwnProfile ? 'My Profile' : 'Friend Profile';
    }

    const profilePicUrl = pageUserData?.profile_pic;
    setProfilePicture(profilePicUrl);

    window.dropDownHelpers = await loadInstitutionsAndDiplomas();
    const savedProfileSettings = loadProfileSettings();
    populateProfileSettings(savedProfileSettings);

    if (urlParams.get('settings') === 'true') {
        settingsModal?.show();
    }

    if (profileUploadButton) {
        profileUploadButton.style.display = (!isViewProfilePage && pageUserId && currentUserId && currentUserId.toString() === pageUserId.toString()) ? 'flex' : 'none';
    }

    await updateProfileUI(pageUserData);

    const name = pageUserData?.name || 'User';
    const username = pageUserData?.username || 'user';
    if (profileNameEl) {
        profileNameEl.innerHTML = `${name} <small class="text-secondary">(${username})</small>`;
    }

    if (profileAboutEl) {
        profileAboutEl.innerText = pageUserData?.profile_text || pageUserData?.bio || 'No profile text available.';
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

    const friendRequestModalElement = document.getElementById('friendRequestModal');
    const friendRequestModalTitle = document.getElementById('friendRequestModalLabel');
    const friendRequestList = document.getElementById('friend-request-list');
    const friendRequestEmpty = document.getElementById('friend-request-empty');
    const incomingRequestsBtn = document.getElementById('incoming-requests-btn');
    const outgoingRequestsBtn = document.getElementById('outgoing-requests-btn');

    const friendRequestModal = friendRequestModalElement ? new bootstrap.Modal(friendRequestModalElement) : null;

    const renderRequests = (type, requests) => {
        if (!friendRequestList || !friendRequestEmpty) return;

        if (!requests || requests.length === 0) {
            friendRequestList.innerHTML = '';
            friendRequestEmpty.textContent = type === 'incoming'
                ? 'No incoming friend requests at the moment.'
                : 'No outgoing friend requests at the moment.';
            friendRequestEmpty.style.display = 'block';
            return;
        }

        friendRequestEmpty.style.display = 'none';
        friendRequestList.innerHTML = requests.map(request => {
            const header = type === 'incoming'
                ? `${request.sender_name || 'Unknown'} (@${request.sender_username || 'unknown'})`
                : `${request.receiver_name || 'Unknown'} (@${request.receiver_username || 'unknown'})`;

            const actionButtons = type === 'incoming'
                ? `
                    <button class="btn btn-sm btn-success me-2" data-action="accept" data-request-id="${request.request_id}">Accept</button>
                    <button class="btn btn-sm btn-outline-danger" data-action="reject" data-request-id="${request.request_id}">Reject</button>
                `
                : `
                    <button class="btn btn-sm btn-outline-danger" data-action="cancel" data-request-id="${request.request_id}">Cancel</button>
                `;

            return `
                <div class="list-group-item d-flex flex-column gap-3">
                    <div class="d-flex justify-content-between align-items-start gap-3">
                        <div>
                            <div class="fw-semibold">${header}</div>
                            <small class="text-secondary">Requested ${new Date(request.created_at).toLocaleString()}</small>
                        </div>
                        <div>${actionButtons}</div>
                    </div>
                    <div class="text-secondary">
                        Request ID: ${request.request_id}
                    </div>
                </div>
            `;
        }).join('');
    };

    const requestWithBody = async (endpoint, method = 'GET') => {
        try {
            const response = await fetch(`${API_URL}${endpoint}`, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    ...requestHeaders,
                },
            });

            if (response.status === 204) return { status: 204 };

            const data = await response.json();
            return { status: response.status, data };
        } catch (error) {
            console.error('Friend request API error:', error);
            return { status: 500, data: null };
        }
    };

    const loadFriendRequests = async (type) => {
        if (!userId) return;

        const endpoint = type === 'incoming'
            ? `/api/friendrequest/incoming/${userId}`
            : `/api/friendrequest/outgoing/${userId}`;

        const response = await requestWithBody(endpoint, 'GET');
        if (response.status >= 200 && response.status < 300) {
            renderRequests(type, response.data);
            friendRequestModalTitle.textContent = type === 'incoming' ? 'Incoming Friend Requests' : 'Outgoing Friend Requests';
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
            const currentType = friendRequestModalTitle.textContent.toLowerCase().includes('incoming') ? 'incoming' : 'outgoing';
            await loadFriendRequests(currentType);
        } else {
            console.error('Failed to update friend request', response.data);
            alert('Unable to complete the request. Please try again.');
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

    if (profileFriendsList) {
        const friendsEndpoint = isViewProfilePage && friendId
            ? `/api/friend/${friendId}`
            : '/api/friend';

        // Load the friend list for the current page.
        // If viewing a friend's profile, request that friend's connections.
        const friends = await fetchJson(friendsEndpoint);
        if (!friends || friends.length === 0) {
            profileFriendsList.innerHTML = '<div class="text-secondary">No friends found.</div>';
        } else {
            profileFriendsList.innerHTML = friends.map(friend => {
                const initials = friend.name ? friend.name.charAt(0).toUpperCase() : 'U';
                return `
                    <div class="connection-item">
                        <div class="connection-user">
                            <div class="avatar-sm d-flex align-items-center justify-content-center bg-secondary text-white fw-bold">${initials}</div>
                            <div>
                                <div class="fw-semibold">${friend.name || 'Friend'}</div>
                                <small class="text-secondary">@${friend.username || 'unknown'}</small>
                            </div>
                        </div>
                        <a href="viewProfile.html?friendId=${friend.friend_id}" class="btn btn-sm btn-white">View</a>
                    </div>
                `;
            }).join('');
        }
    }

    if (profileBadgesList) {
        const userBadges = await fetchJson(`/api/userbadges/${pageUserId}`);

        if (!userBadges || !Array.isArray(userBadges) || userBadges.length === 0) {
            profileBadgesList.innerHTML = '<span class="text-secondary">No badges yet.</span>';
        } else {
            const getBadgeLabel = (badge) => {
                return (
                    badge?.badge_name ||
                    badge?.name ||
                    badge?.title ||
                    badge?.badge ||
                    badge?.id ||
                    'Badge'
                );
            };

            profileBadgesList.innerHTML = userBadges
                .map((badge) => {
                    const label = getBadgeLabel(badge);
                    return `<span class="badge-item">${label}</span>`;
                })
                .join('');
        }
    }
});