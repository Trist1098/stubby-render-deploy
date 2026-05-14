document.addEventListener('DOMContentLoaded', async () => {
    if (typeof auth === 'undefined') {
        console.error('auth is not defined. Ensure js/core/auth.js is loaded.');
        return;
    }

    const userData = localStorage.getItem("user") ? JSON.parse(localStorage.getItem("user")) : null;

    const profileNameEl = document.getElementById('profile-name');
    const profileDiplomaEl = document.getElementById('profile-diploma');
    const profileInstitutionEl = document.getElementById('profile-institution');
    const profileAboutEl = document.getElementById('profile-about-text');
    const profileFriendsList = document.getElementById('profile-friends-list');
    const profileBadgesList = document.getElementById('profile-badges-list');
    const profileActions = document.querySelector('.profile-action-buttons');


    // Name and Username
    const name = userData.name || 'User';
    const username = userData.username || 'user';
    if (profileNameEl) {
        profileNameEl.innerHTML = `${name} <small class="text-secondary">(${username})</small>`;
    }

    if (profileAboutEl) {
        profileAboutEl.innerText = userData.profile_text || userData.bio || 'No profile text available.';
    }

    if (profileActions) {
        const currentUserId = userData.user_id || userData.id || userData.userId;
        const params = new URLSearchParams(window.location.search);
        const profileOwnerId = params.get('userId') || params.get('user_id') || params.get('id');
        const isOwnProfile = !profileOwnerId || (currentUserId && currentUserId.toString() === profileOwnerId);
        if (isOwnProfile) {
            profileActions.style.display = 'none';
        }
    }

    const token = auth.getToken();
    const requestHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};

    const fetchJson = async (endpoint) => {
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
    };

    const diplomaId = userData.diploma_id;
    if (profileDiplomaEl) {
        if (diplomaId) {
            const diplomaData = await fetchJson(`/api/diploma/${diplomaId}`);
            const diploma = Array.isArray(diplomaData) ? diplomaData[0] : diplomaData;
            profileDiplomaEl.textContent = diploma?.name || 'No diploma selected';
        } else {
            profileDiplomaEl.textContent = 'No diploma selected';
        }
    }

    const institutionId = userData.institution_id;
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
        const friends = await fetchJson('/api/friend');
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
                        <button class="btn btn-sm btn-white">View</button>
                    </div>
                `;
            }).join('');
        }
    }

    // Badges
    const userId = userData.user_id;
    if (profileBadgesList) {
        const userBadges = await fetchJson(`/api/userbadges/${userId}`);

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
