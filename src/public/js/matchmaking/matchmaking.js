document.addEventListener("DOMContentLoaded", function () {
    if (typeof auth === 'undefined' || !auth.isLoggedIn()) { 
        window.location.href = 'login.html'; 
        return;
    }

    let allStudents = [];
    let activeMatches = [];
    let savedStudents = [];
    let visibleActiveMatchesCount = 3;
    let masterModules = []; 
    let availableLanguages = [];
    let visibleMatchesCount = 7;
    const ACTIVE_MATCHES_PAGE_SIZE = 3;
    const MAX_COMPARE_STUDENTS = 3;
    let compareSelection = [];
    let userPreferences = {
        selected_modules: [],
        availability_days: [],
        selected_modes: [],
        selected_times: [],
        start_time: '',
        end_time: '',
        style: 'discussion',
        duration: 60,
        priority: 50,
        gender_pref: 'any',
        partner_level: 'same',
        additional_details: '',
        auto_match_enabled: false,
        selected_languages: []
    };

    // --- GLOBAL FUNCTIONS (EXPOSED TO WINDOW) ---
    window.switchTab = function(tab) {
        const isBrowse = tab === 'browse';
        document.getElementById('browseSection').style.display = isBrowse ? 'block' : 'none';
        document.getElementById('requestsSection').style.display = isBrowse ? 'none' : 'block';
        
        // Update hero text
        document.getElementById('pageTitle').innerText = isBrowse ? 'FIND STUDY PARTNERS' : 'MY STUDY REQUESTS';
        document.getElementById('pageSubtitle').innerText = isBrowse ? 
            'Discover students with similar modules and goals.' : 
            'Manage your incoming and outgoing study invitations.';
            
        // Update dropdown active state
        document.getElementById('tab-browse').classList.toggle('active', isBrowse);
        document.getElementById('tab-requests').classList.toggle('active', !isBrowse);

        if (tab === 'requests') loadRequests();
    };

    window.showModuleResults = function() {
        const list = document.getElementById('moduleResultsList');
        if (!list) return;
        list.style.display = 'block';
        window.filterModuleSelect();
    };

    window.hideModuleResults = function() {
        const list = document.getElementById('moduleResultsList');
        if (list) {
            setTimeout(() => { list.style.display = 'none'; }, 200);
        }
    };

    window.filterModuleSelect = function() {
        const input = document.getElementById('moduleSearchInput');
        const list = document.getElementById('moduleResultsList');
        if (!input || !list) return;

        const keyword = input.value.toLowerCase();
        const filtered = masterModules.filter(m => 
            (m.code && m.code.toLowerCase().includes(keyword)) || 
            (m.name && m.name.toLowerCase().includes(keyword))
        );

        list.innerHTML = '';
        if (filtered.length === 0) {
            list.innerHTML = '<div class="dropdown-item disabled text-muted p-3">No modules found</div>';
        } else {
            filtered.forEach(m => {
                const isSelected = userPreferences.selected_modules.includes(m.module_id);
                list.innerHTML += `
                    <div class="dropdown-item py-3 px-4 cursor-pointer d-flex justify-content-between align-items-center ${isSelected ? 'selected' : ''}" 
                        onclick="window.addPrefModule(${m.module_id})">
                        <div>
                            <span class="fw-bold text-dark">${escapeHTML(m.code)}</span>
                            <span class="text-muted small ms-2">${escapeHTML(m.name)}</span>
                        </div>
                        ${isSelected ? '<i class="fas fa-check-circle text-primary"></i>' : '<i class="fas fa-plus text-muted opacity-25"></i>'}
                    </div>
                `;
            });
        }
    };

    window.addPrefModule = function(id) {
        if (!userPreferences.selected_modules.includes(id)) {
            userPreferences.selected_modules.push(id);
        } else {
            userPreferences.selected_modules = userPreferences.selected_modules.filter(mid => mid != id);
        }
        renderPreferences();
        window.filterModuleSelect();
    };

    window.removePrefModule = function(id) {
        userPreferences.selected_modules = userPreferences.selected_modules.filter(mid => mid != id);
        renderPreferences();
        window.filterModuleSelect();
    };

    window.triggerAutoMatch = function() {
        const grid = document.getElementById('studentGrid');
        if (grid) grid.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border text-primary"></div></div>';
        loadStudents();
    };

    window.resetPreferences = function() {
        showConfirm("Are you sure you want to reset all preferences? This cannot be undone.", async () => {
            userPreferences = {
                selected_modules: [],
                availability_days: [],
                selected_modes: [],
                selected_times: [],
                start_time: '',
                end_time: '',
                style: 'discussion',
                duration: 60,
                priority: 50,
                gender_pref: 'any',
                partner_level: 'same',
                additional_details: '',
                auto_match_enabled: false,
                selected_languages: []
            };
            
            await savePreferences(true);
        }, {
            title: 'Reset Matchmaking Preferences',
            confirmText: 'Reset',
        });
    };

    function showSuccess(msg, callback) {
        const msgEl = document.getElementById('successModalMessage');
        if (msgEl) msgEl.innerText = msg;
        const modalEl = document.getElementById('successModal');
        const modal = new bootstrap.Modal(modalEl);
        
        if (callback) {
            modalEl.addEventListener('hidden.bs.modal', callback, { once: true });
        }
        
        modal.show();
    }

    function showConfirm(msg, callback, options = {}) {
        const titleEl = document.getElementById('confirmModalTitle');
        const msgEl = document.getElementById('confirmModalMessage');
        if (titleEl) titleEl.innerText = options.title || 'Confirm Action';
        if (msgEl) msgEl.innerText = msg;
        const btn = document.getElementById('confirmModalBtn');
        const modalEl = document.getElementById('confirmModal');
        const modal = new bootstrap.Modal(modalEl);
        btn.innerText = options.confirmText || 'Confirm';
        btn.className = `btn ${options.confirmClass || 'btn-accent'} flex-grow-1 py-3 rounded-4 fw-bold uppercase small`;
        
        btn.onclick = () => {
            modal.hide();
            modalEl.addEventListener('hidden.bs.modal', () => callback(), { once: true });
        };
        modal.show();
    }

    function showThemedAlert(message, options = {}) {
        const title = options.title || 'Heads up';
        const tone = options.tone || 'warning';
        const toneMap = {
            danger: {
                icon: 'fa-exclamation-circle text-danger',
                button: 'btn-danger',
            },
            warning: {
                icon: 'fa-exclamation-triangle text-warning',
                button: 'btn-accent',
            },
            info: {
                icon: 'fa-circle-info text-primary',
                button: 'btn-accent',
            },
        };
        const selectedTone = toneMap[tone] || toneMap.warning;

        const modalHtml = `
            <div class="modal fade" id="dynamicAlertModal" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content border-0 rounded-4 shadow-lg">
                        <div class="modal-body p-5 text-center">
                            <i class="fas ${selectedTone.icon} fa-3x mb-4"></i>
                            <h4 class="fw-bold mb-3">${escapeHTML(title)}</h4>
                            <p class="text-muted mb-4">${escapeHTML(message)}</p>
                            <button type="button" class="btn ${selectedTone.button} px-5 py-2 rounded-pill fw-bold" data-bs-dismiss="modal">OK</button>
                        </div>
                    </div>
                </div>
            </div>`;

        const old = document.getElementById('dynamicAlertModal');
        if (old) old.remove();

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modalEl = document.getElementById('dynamicAlertModal');
        const modal = new bootstrap.Modal(modalEl);
        modalEl.addEventListener('hidden.bs.modal', () => modalEl.remove(), { once: true });
        modal.show();
    }

    async function init() {
        try {
            await Promise.all([
                loadModules(),
                loadLanguages(),
                loadPreferences(),
                loadStudents(),
                loadRequests()
            ]);
            setupEventListeners();
            renderPreferences();
            renderFilterModules();

            const params = new URLSearchParams(window.location.search);
            const tab = params.get('tab');
            if (tab === 'requests') switchTab('requests');
            else if (tab === 'browse') switchTab('browse');

        } catch (err) {
            console.error("Init Error:", err);
        }
    }

    function renderFilterModules() {
        const container = document.getElementById('filterModules');
        if (!container) return;
        
        const parentDiv = container.closest('.mb-4');
        const selected = Array.isArray(userPreferences.selected_modules) ? userPreferences.selected_modules : [];

        if (selected.length === 0) {
            if (parentDiv) parentDiv.style.display = 'none';
            return;
        }
        
        if (parentDiv) parentDiv.style.display = 'block';
        container.innerHTML = '';

        selected.forEach(mid => {
            const m = masterModules.find(um => um.module_id == mid);
            const code = m ? m.code : mid;
            container.innerHTML += `
                <div class="d-inline-block ps-1 mb-1">
                    <input class="btn-check" type="checkbox" value="${mid}" id="filterMod${mid}" onchange="filterStudents()">
                    <label class="btn btn-outline-primary btn-sm rounded-pill px-2 py-1 smaller fw-bold" for="filterMod${mid}">
                        ${code}
                    </label>
                </div>
            `;
        });
    }

    async function loadModules() {
        try {
            const res = await fetch('/api/usermodules', {
                headers: { 'Authorization': `Bearer ${auth.getToken()}` }
            });
            if (res.status === 401) return auth.logout();
            if (res.ok) {
                masterModules = await res.json();
            }
        } catch (err) { console.error("Modules Load Error:", err); }
    }

    async function loadLanguages() {
        try {
            const res = await fetch('/api/languages', {
                headers: { 'Authorization': `Bearer ${auth.getToken()}` }
            });
            if (res.status === 401) return auth.logout();
            if (res.ok) {
                availableLanguages = await res.json();
                const select = document.getElementById('prefLanguages');
                if (select) {
                    select.innerHTML = '';
                    availableLanguages.forEach(l => {
                        select.innerHTML += `<option value="${escapeHTML(l.name)}">${escapeHTML(l.name.toUpperCase())}</option>`;
                    });
                }
            }
        } catch (err) { console.error("Languages Load Error:", err); }
    }

    async function loadPreferences() {
        try {
            const res = await fetch('/api/preferences', {
                headers: { 'Authorization': `Bearer ${auth.getToken()}` }
            });
            if (res.status === 401) return auth.logout();
            if (res.ok) {
                const data = await res.json();
                if (data) {
                    userPreferences = {
                        selected_modules: data.selected_modules || [],
                        availability_days: data.availability_days || [],
                        selected_modes: data.selected_modes || [],
                        selected_times: data.selected_times || [],
                        start_time: data.start_time || '',
                        end_time: data.end_time || '',
                        style: data.style || 'discussion',
                        duration: data.duration || 60,
                        priority: data.priority || 50,
                        gender_pref: data.gender_pref || 'any',
                        partner_level: data.partner_level || 'same',
                        additional_details: data.additional_details || '',
                        auto_match_enabled: data.auto_match_enabled || false,
                        selected_languages: data.selected_languages || []
                    };
                    
                    ['selected_modules', 'availability_days', 'selected_modes', 'selected_times', 'selected_languages'].forEach(key => {
                        if (typeof userPreferences[key] === 'string') {
                            try { userPreferences[key] = JSON.parse(userPreferences[key]); } 
                            catch(e) { userPreferences[key] = []; }
                        }
                    });
                }
            }
        } catch (err) { console.error("Preferences Load Error:", err); }
    }

    async function savePreferences(isReset = false) {
        const form = document.getElementById('preferencesForm');
        if (!form) return;

        let data;
        if (isReset) {
            data = { ...userPreferences };
        } else {
            const langSelect = document.getElementById('prefLanguages');
            const selectedLangs = langSelect ? Array.from(langSelect.selectedOptions).map(opt => opt.value) : userPreferences.selected_languages;
            const genderVal = form.querySelector('input[name="genderPref"]:checked')?.value || userPreferences.gender_pref;
            const learningVal = form.querySelector('input[name="learningMode"]:checked')?.value || userPreferences.partner_level;

            data = {
                selected_modules: userPreferences.selected_modules,
                availability_days: Array.from(form.querySelectorAll('[id^="day"]:checked')).map(el => el.value),
                selected_modes: Array.from(form.querySelectorAll('#modeOnline:checked, #modeCampus:checked')).map(el => el.value),
                selected_times: Array.from(form.querySelectorAll('#timeMorning:checked, #timeAfternoon:checked, #timeEvening:checked')).map(el => el.value),
                style: Array.from(form.querySelectorAll('[id^="style"]:checked')).map(el => el.value).join(',') || userPreferences.style,
                gender_pref: genderVal,
                partner_level: learningVal,
                duration: parseInt(document.getElementById('prefDuration')?.value || userPreferences.duration),
                priority: parseInt(document.getElementById('prefPriority')?.value || userPreferences.priority),
                auto_match_enabled: document.getElementById('autoMatchEnabled')?.checked || false,
                additional_details: document.getElementById('prefDetails')?.value || userPreferences.additional_details,
                selected_languages: selectedLangs
            };
        }

        try {
            const res = await fetch('/api/preferences', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${auth.getToken()}`
                },
                body: JSON.stringify(data)
            });
            if (res.status === 401) return auth.logout();
            if (res.ok) {
                const modalEl = document.getElementById('preferencesModal');
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();
                await loadPreferences();
                renderPreferences();
                renderFilterModules();
                window.filterStudents();
                const successMsg = isReset 
                    ? "All preferences have been reset to defaults."
                    : "Your match preferences have been updated successfully.";
                showSuccess(successMsg);
            } else {
                const errData = await res.json();
                showThemedAlert(`Save Error: ${errData.error || res.status}`, {
                    title: 'Preferences Not Saved',
                    tone: 'danger',
                });
            }
        } catch (err) {
            showThemedAlert('Network error saving preferences.', {
                title: 'Connection Issue',
                tone: 'danger',
            });
        }
    }

    function mergeStudentLists(primaryList, savedList) {
        const map = new Map();
        primaryList.forEach(student => {
            map.set(Number(student.user_id), {
                ...student,
                is_saved: Boolean(student.is_saved),
            });
        });
        savedList.forEach(student => {
            const id = Number(student.user_id);
            const existing = map.get(id) || {};
            map.set(id, {
                ...student,
                ...existing,
                is_saved: true,
            });
        });
        return Array.from(map.values());
    }

    async function fetchSavedStudents() {
        const res = await fetch('/api/matches/saved', {
            headers: { 'Authorization': `Bearer ${auth.getToken()}` }
        });
        if (res.status === 401) {
            auth.logout();
            return [];
        }
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data.matches) ? data.matches : [];
    }

    async function loadStudents() {
        try {
            const headers = { 'Authorization': `Bearer ${auth.getToken()}` };
            const [res, savedList] = await Promise.all([
                fetch('/api/matches/auto', { headers }),
                fetchSavedStudents()
            ]);
            if (res.status === 401) return auth.logout();
            if (res.ok) {
                const data = await res.json();
                savedStudents = savedList;
                allStudents = mergeStudentLists(data.matches || [], savedStudents);

                // Dynamic Live Peers Hero Stat
                const livePeersEl = document.getElementById('stat-live-peers');
                if (livePeersEl) {
                    const onlineCount = allStudents.filter((s) => s.is_online).length;
                    livePeersEl.innerText = onlineCount.toString();
                }

                // Dynamic average match quality hero stat
                const successRateEl = document.getElementById('stat-success-rate');
                if (successRateEl) {
                    const scores = allStudents.map(getMatchScore).filter(score => score > 0);
                    if (scores.length > 0) {
                        const averageScore = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
                        successRateEl.innerText = `${averageScore}% avg`;
                    } else {
                        successRateEl.innerText = 'Set prefs';
                    }
                }
            }
            window.filterStudents();
        } catch (err) { 
            allStudents = [];
            window.filterStudents();
        }
    }

    async function loadActiveMatchesDashboard() {
        try {
            const res = await fetch('/api/matches/active', {
                headers: { Authorization: `Bearer ${auth.getToken()}` },
            });
            if (res.ok) {
                activeMatches = await res.json();
                visibleActiveMatchesCount = ACTIVE_MATCHES_PAGE_SIZE;
                const matchesCountEl = document.getElementById('stat-total-matches');
                if (matchesCountEl) {
                    const count = Array.isArray(activeMatches) ? activeMatches.length : 0;
                    matchesCountEl.innerText = count === 1 ? '1 Active' : `${count} Active`;
                }
                renderActiveMatches(activeMatches);
            }
        } catch (err) {
            console.error('Error fetching active matches:', err);
            renderActiveMatches([]);
        }
    }

    function renderPreferences() {
        const moduleContainer = document.getElementById('prefModules');
        if (moduleContainer) {
            moduleContainer.innerHTML = '';
            userPreferences.selected_modules.forEach(mid => {
                const m = masterModules.find(um => um.module_id == mid);
                const code = m ? m.code : `Invalid (${mid})`;
                moduleContainer.innerHTML += `
                    <span class="badge bg-primary rounded-pill p-2 px-3 fw-bold shadow-sm d-flex align-items-center gap-2">
                        ${escapeHTML(code)}
                        <i class="fas fa-times-circle cursor-pointer" onclick="window.removePrefModule(${mid})"></i>
                    </span>
                `;
            });
        }

        const summaryModules = document.getElementById('summaryModuleCount');
        if (summaryModules) summaryModules.innerText = `${userPreferences.selected_modules.length} Modules Tracked`;

        const summarySchedule = document.getElementById('summarySchedule');
        if (summarySchedule) {
            const days = userPreferences.availability_days || [];
            summarySchedule.innerText = days.length > 0 ? `${days.length} Days Set` : 'Not set';
        }

        const summaryAutoMatch = document.getElementById('summaryAutoMatch');
        if (summaryAutoMatch) {
            summaryAutoMatch.innerText = userPreferences.auto_match_enabled ? 'Auto-Match On' : 'Manual Only';
        }
        const summaryMatchPotential = document.getElementById('summaryMatchPotential');
        if (summaryMatchPotential) {
            const modules = userPreferences.selected_modules || [];
            const days = userPreferences.availability_days || [];
            const times = normalizeList(userPreferences.selected_times);
            const modes = normalizeList(userPreferences.selected_modes);
            if (modules.length === 0) {
                summaryMatchPotential.innerText = 'Add modules so matches can be ranked by shared classes.';
            } else if (days.length === 0 || times.length === 0) {
                summaryMatchPotential.innerText = 'Add availability to unlock better schedule suggestions.';
            } else if (modes.length === 0) {
                summaryMatchPotential.innerText = 'Choose online or campus mode to filter stronger partners.';
            } else {
                summaryMatchPotential.innerText = 'Profile ready: matches can use modules, schedule, and mode.';
            }
        }
        const summaryActiveTimes = document.getElementById('summaryActiveTimes');
        if (summaryActiveTimes) {
            const times = normalizeList(userPreferences.selected_times);
            summaryActiveTimes.innerText = times.length > 0
                ? times.map(cap).join(', ')
                : 'Set your availability to improve schedule suggestions.';
        }

        const form = document.getElementById('preferencesForm');
        if (form) {
            const learningRadio = form.querySelector(`input[name="learningMode"][value="${userPreferences.partner_level}"]`);
            if (learningRadio) learningRadio.checked = true;
            const genderRadio = form.querySelector(`input[name="genderPref"][value="${userPreferences.gender_pref}"]`);
            if (genderRadio) genderRadio.checked = true;
            const durInput = document.getElementById('prefDuration');
            if (durInput) durInput.value = userPreferences.duration;
            const priInput = document.getElementById('prefPriority');
            if (priInput) priInput.value = userPreferences.priority;
            const autoToggle = document.getElementById('autoMatchEnabled');
            if (autoToggle) autoToggle.checked = userPreferences.auto_match_enabled;
            const detailsInput = document.getElementById('prefDetails');
            if (detailsInput) detailsInput.value = userPreferences.additional_details;
            const langSelect = document.getElementById('prefLanguages');
            if (langSelect) {
                Array.from(langSelect.options).forEach(opt => {
                    opt.selected = userPreferences.selected_languages.includes(opt.value);
                });
            }
            const checkboxGroups = [
                { values: normalizeList(userPreferences.availability_days), selector: '#preferencesForm [id^="day"]' },
                { values: normalizeList(userPreferences.selected_modes), selector: '#modeOnline, #modeCampus' },
                { values: normalizeList(userPreferences.selected_times), selector: '#timeMorning, #timeAfternoon, #timeEvening' },
                { values: normalizeList(userPreferences.style), selector: '#stylequiet, #stylediscussion, #stylegroup' },
            ];
            checkboxGroups.forEach(({ values, selector }) => {
                document.querySelectorAll(selector).forEach(el => {
                    if (el.type === 'checkbox') el.checked = values.includes(el.value);
                });
            });
        }
        toggleAutoMatchVisibility();
    }

    window.filterStudents = function(resetPagination = true) {
        if (resetPagination) {
            visibleMatchesCount = 7;
        }
        const searchInput = document.getElementById('searchInput');
        if (!searchInput) return;
        const search = searchInput.value.toLowerCase();
        const onlineOnly = document.getElementById('onlineFilter')?.checked || false;
        const savedOnly = document.getElementById('savedOnlyFilter')?.checked || false;
        const sortBy = document.getElementById('sortSelect')?.value || 'match';
        const selectedModuleIds = Array.from(document.querySelectorAll('#filterModules input:checked')).map(el => el.value);

        let filtered = allStudents.filter(s => {
            const isUnavailable = isUnavailableMatchStatus(s.request_status);
            const matchesSearch = s.name.toLowerCase().includes(search) || (s.modules && s.modules.toLowerCase().includes(search));
            const matchesOnline = !onlineOnly || isFlagOn(s.is_online);
            const matchesSaved = !savedOnly || isFlagOn(s.is_saved);
            const studentModules = (s.modules || '').split(',').map(m => m.trim());
            const matchesModules = selectedModuleIds.length === 0 || selectedModuleIds.some(mid => {
                const m = masterModules.find(um => um.module_id == mid);
                return m && studentModules.includes(m.code);
            });

            return !isUnavailable && matchesSearch && matchesOnline && matchesSaved && matchesModules;
        });

        if (sortBy === 'match') {
            filtered.sort((a, b) => {
                return getMatchScore(b) - getMatchScore(a);
            });
        } else if (sortBy === 'shared') {
            filtered.sort((a, b) => {
                const sharedDiff = (Number(b.shared_modules_count) || 0) - (Number(a.shared_modules_count) || 0);
                return sharedDiff || getMatchScore(b) - getMatchScore(a);
            });
        } else if (sortBy === 'online') {
            filtered.sort((a, b) => {
                const onlineDiff = Number(isFlagOn(b.is_online)) - Number(isFlagOn(a.is_online));
                return onlineDiff || getMatchScore(b) - getMatchScore(a);
            });
        } else if (sortBy === 'saved') {
            filtered.sort((a, b) => {
                const savedDiff = Number(isFlagOn(b.is_saved)) - Number(isFlagOn(a.is_saved));
                return savedDiff || getMatchScore(b) - getMatchScore(a);
            });
        } else if (sortBy === 'name') {
            filtered.sort((a, b) => a.name.localeCompare(b.name));
        }
        renderStudents(filtered);
    };

    window.loadMorePeers = function() {
        visibleMatchesCount += 6;
        window.filterStudents(false);
    };

    function getInitials(name) {
        if (!name) return 'U';
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return parts[0][0].toUpperCase();
    }

    function escapeHTML(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[char]);
    }

    function normalizeList(value) {
        if (!value) return [];
        if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) return [];
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) return parsed.map(item => String(item).trim()).filter(Boolean);
            } catch (e) {
                // Comma-separated values are used by a few older preference fields.
            }
            return trimmed.split(',').map(item => item.trim()).filter(Boolean);
        }
        return [String(value).trim()].filter(Boolean);
    }

    function cap(value) {
        if (!value) return '';
        const text = String(value).replace(/-/g, ' ');
        return text.charAt(0).toUpperCase() + text.slice(1);
    }

    function isFlagOn(value) {
        if (value === true || value === 1) return true;
        if (value === false || value === 0 || value == null) return false;
        return ['true', '1', 'yes', 'y'].includes(String(value).trim().toLowerCase());
    }

    function getAvatarHTML(profilePic, name, sizeClass = '') {
        if (profilePic) {
            return `<img src="${escapeHTML(profilePic)}" alt="${escapeHTML(name)}" class="avatar-img rounded-circle w-100 h-100 object-fit-cover">`;
        }
        const initials = getInitials(name);
        const colors = [
            'bg-primary-subtle text-primary',
            'bg-success-subtle text-success',
            'bg-info-subtle text-info',
            'bg-warning-subtle text-warning',
            'bg-danger-subtle text-danger',
        ];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        const colorClass = colors[Math.abs(hash) % colors.length];

        return `<div class="avatar-initials rounded-circle w-100 h-100 d-flex align-items-center justify-content-center fw-bold ${colorClass} ${sizeClass}" style="font-size: 40%; letter-spacing: 0.5px;">${escapeHTML(initials)}</div>`;
    }

    function getMatchScore(student) {
        const explicitScore = Number(student?.match_percentage);
        if (!Number.isNaN(explicitScore)) return Math.min(Math.max(Math.round(explicitScore), 0), 100);
        const sharedCount = Number(student?.shared_modules_count) || 0;
        return Math.min(sharedCount * 25, 100);
    }

    function isUnavailableMatchStatus(status) {
        return ['accepted', 'pending'].includes(String(status || '').toLowerCase());
    }

    function getStudentModules(student) {
        return (student?.modules || '').split(',').map(m => m.trim()).filter(Boolean);
    }

    function getSharedModuleCodes(student) {
        const myModuleCodes = masterModules.map(m => String(m.code || '').trim().toUpperCase()).filter(Boolean);
        return getStudentModules(student).filter(code => myModuleCodes.includes(code.toUpperCase()));
    }

    function getOverlap(myValues, peerValues) {
        const peerLower = peerValues.map(value => value.toLowerCase());
        return myValues.filter(value => peerLower.includes(String(value).toLowerCase()));
    }

    function summarizeList(values, fallback = 'Not set') {
        return values.length > 0 ? values.map(cap).join(', ') : fallback;
    }

    function getStudentById(userId) {
        return allStudents.find(student => Number(student.user_id) === Number(userId));
    }

    function getComparedStudents() {
        return compareSelection
            .map(getStudentById)
            .filter(student => student && !isUnavailableMatchStatus(student.request_status));
    }

    function getCompareButtonHTML(student, className) {
        return `
            <button type="button"
                class="${className} compare-toggle-btn"
                data-compare-id="${student.user_id}"
                aria-pressed="false"
                onclick="event.stopPropagation(); window.toggleCompareStudent(${student.user_id})">
                <i class="fas fa-code-compare me-1"></i>Compare
            </button>
        `;
    }

    function getProfileButtonHTML(userId, className, label = 'Profile') {
        return `
            <button class="${className}" onclick="event.stopPropagation(); window.openProfileModal(${userId})">
                <i class="fas fa-user-circle me-1"></i>${label}
            </button>
        `;
    }

    function getProfileIconButtonHTML(userId) {
        return `
            <button type="button"
                class="btn btn-white match-card-icon-btn"
                title="View profile"
                aria-label="View profile"
                onclick="event.stopPropagation(); window.openProfileModal(${userId})">
                <i class="fas fa-user-circle"></i>
            </button>
        `;
    }

    function getSaveButtonHTML(student, className) {
        const isSaved = Boolean(student.is_saved);
        return `
            <button type="button"
                class="${className} save-student-btn ${isSaved ? 'is-saved' : ''}"
                aria-pressed="${isSaved ? 'true' : 'false'}"
                onclick="event.stopPropagation(); window.toggleSavedStudent(${student.user_id})">
                <i class="${isSaved ? 'fas' : 'far'} fa-bookmark me-1"></i>${isSaved ? 'Saved' : 'Save'}
            </button>
        `;
    }

    function getSaveIconButtonHTML(student) {
        const isSaved = Boolean(student.is_saved);
        return `
            <button type="button"
                class="btn btn-white match-card-icon-btn save-student-btn ${isSaved ? 'is-saved' : ''}"
                title="${isSaved ? 'Remove from shortlist' : 'Save for later'}"
                aria-label="${isSaved ? 'Remove from shortlist' : 'Save for later'}"
                aria-pressed="${isSaved ? 'true' : 'false'}"
                onclick="event.stopPropagation(); window.toggleSavedStudent(${student.user_id})">
                <i class="${isSaved ? 'fas' : 'far'} fa-bookmark"></i>
            </button>
        `;
    }

    function getCompareIconButtonHTML(student) {
        return `
            <button type="button"
                class="btn btn-white match-card-icon-btn compare-toggle-btn"
                data-compare-id="${student.user_id}"
                title="Compare"
                aria-label="Compare"
                aria-pressed="false"
                onclick="event.stopPropagation(); window.toggleCompareStudent(${student.user_id})">
                <i class="fas fa-code-compare"></i>
            </button>
        `;
    }

    function getConnectButtonHTML(student, className, label = 'Connect') {
        if (student.request_status === 'Pending') {
            return `<button class="${className.replace('btn-primary', 'btn-secondary').replace('btn-accent', 'btn-secondary')} text-white" disabled>Request Sent</button>`;
        }

        if (student.request_status === 'Accepted') {
            return `
                <button class="${className.replace('btn-primary', 'btn-success').replace('btn-accent', 'btn-success')} text-white"
                    onclick="event.stopPropagation(); window.openChatWithStudent(${student.user_id})">
                    <i class="fas fa-comments me-1"></i>Message
                </button>
            `;
        }

        return `
            <button class="${className}" onclick="event.stopPropagation(); window.openMatchModal(${student.user_id})">
                <i class="fas fa-paper-plane me-1"></i>${label}
            </button>
        `;
    }

    function getTimeFromSlot(timeSlot) {
        if (!timeSlot) return 'Not scheduled';
        const parts = String(timeSlot).replace('T', ' ').split(' ');
        return (parts[1] || '').slice(0, 5) || 'Not scheduled';
    }

    function getScoreBreakdown(student) {
        if (Array.isArray(student?.match_breakdown) && student.match_breakdown.length > 0) {
            return student.match_breakdown
                .map(item => ({
                    label: item.label || 'Match factor',
                    points: Number(item.points) || 0,
                    max: Number(item.max) || 0,
                    detail: item.detail || '',
                }))
                .filter(item => item.max > 0);
        }

        const score = getMatchScore(student);
        const sharedCount = Number(student?.shared_modules_count) || getSharedModuleCodes(student).length;
        return [{
            label: 'Shared modules',
            points: score,
            max: 100,
            detail: `${sharedCount} shared module${sharedCount === 1 ? '' : 's'}`,
        }];
    }

    function getScoreBreakdownHTML(student) {
        return getScoreBreakdown(student).map(item => {
            const percent = item.max > 0 ? Math.min(Math.round((item.points / item.max) * 100), 100) : 0;
            return `
                <div class="score-breakdown-row">
                    <div class="d-flex justify-content-between gap-3 mb-1">
                        <span class="score-breakdown-label">${escapeHTML(item.label)}</span>
                        <span class="score-breakdown-points">${Math.round(item.points)} / ${Math.round(item.max)}</span>
                    </div>
                    <div class="score-breakdown-track">
                        <div class="score-breakdown-fill" style="width: ${percent}%"></div>
                    </div>
                    <div class="score-breakdown-detail">${escapeHTML(item.detail)}</div>
                </div>
            `;
        }).join('');
    }

    function getMatchSummary(student) {
        if (student?.profile_text && student.profile_text.trim()) {
            return student.profile_text.trim();
        }
        const strongestFactor = getScoreBreakdown(student)
            .filter(item => item.points > 0)
            .sort((a, b) => (b.points / b.max) - (a.points / a.max))[0];
        if (strongestFactor) {
            return `${strongestFactor.label}: ${strongestFactor.detail}`;
        }
        return 'This profile has limited matching data.';
    }

    function getStudentCardSummary(student) {
        const summary = getMatchSummary(student);
        if (!summary) return 'Open profile to review study goals and preferences.';
        return summary.length > 118 ? `${summary.slice(0, 115).trim()}...` : summary;
    }

    function renderActiveMatches(matches) {
        const grid = document.getElementById('activeMatchesGrid');
        const countEl = document.getElementById('activeMatchesCount');
        const actions = document.getElementById('activeMatchesActions');
        const toggleBtn = document.getElementById('activeMatchesToggle');
        const list = Array.isArray(matches) ? matches : [];

        if (countEl) countEl.innerText = `${list.length} active`;
        if (!grid) return;

        if (list.length === 0) {
            if (actions) actions.classList.add('d-none');
            grid.innerHTML = `
                <div class="col-12">
                    <div class="active-match-empty">
                        <i class="fas fa-handshake"></i>
                        <div>
                            <strong>No accepted matches yet</strong>
                            <p class="mb-0">Accepted study requests will appear here with chat and calendar actions.</p>
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        const hasExtraMatches = list.length > ACTIVE_MATCHES_PAGE_SIZE;
        const isShowingAll = visibleActiveMatchesCount >= list.length;
        const visibleList = list.slice(0, visibleActiveMatchesCount);
        if (actions) actions.classList.toggle('d-none', !hasExtraMatches);
        if (toggleBtn) {
            toggleBtn.innerText = isShowingAll ? 'Show less' : `Show all ${list.length}`;
            toggleBtn.onclick = () => {
                visibleActiveMatchesCount = isShowingAll ? ACTIVE_MATCHES_PAGE_SIZE : list.length;
                renderActiveMatches(activeMatches);
            };
        }

        grid.innerHTML = visibleList.map(match => {
            const date = formatDisplayDate(match.time_slot);
            const time = getTimeFromSlot(match.time_slot);
            const moduleLabel = match.module_code
                ? `${match.module_code}${match.module_name ? ` - ${match.module_name}` : ''}`
                : 'General study';
            const sessionType = match.type === 'group' ? 'Group Study' : 'One-on-One';
            const calendarButton = match.event_id
                ? `<a href="home.html" class="btn btn-white active-match-action"><i class="fas fa-calendar-day me-1"></i>Calendar</a>`
                : `<button type="button" class="btn btn-white active-match-action" disabled><i class="fas fa-calendar-day me-1"></i>No event</button>`;

            return `
                <div class="col-md-6 col-xl-4">
                    <article class="active-match-card h-100">
                        <div class="d-flex align-items-start gap-3 mb-3">
                            <div class="active-match-avatar rounded-circle overflow-hidden">
                                ${getAvatarHTML(match.profile_pic, match.name)}
                            </div>
                            <div class="min-w-0 flex-grow-1">
                                <div class="d-flex align-items-center gap-2">
                                    <h5 class="fw-bold mb-0 text-truncate">${escapeHTML(match.name)}</h5>
                                    ${match.is_online ? '<span class="live-pulse-dot"></span>' : ''}
                                </div>
                                <p class="text-muted small mb-0 text-truncate">@${escapeHTML(match.username || 'student')}</p>
                            </div>
                        </div>
                        <div class="active-match-meta mb-3">
                            <div><i class="fas fa-book-open"></i><span>${escapeHTML(moduleLabel)}</span></div>
                            <div><i class="fas fa-calendar-alt"></i><span>${escapeHTML(date)} at ${escapeHTML(time)}</span></div>
                            <div><i class="fas fa-map-marker-alt"></i><span>${escapeHTML(match.location || 'Location not set')}</span></div>
                            <div><i class="fas fa-users"></i><span>${escapeHTML(sessionType)}</span></div>
                        </div>
                        <p class="active-match-topic text-truncate mb-3">${escapeHTML(match.topic || 'No topic added')}</p>
                        <div class="d-flex gap-2">
                            <button type="button" class="btn btn-accent active-match-action" onclick="window.openChatWithStudent(${match.user_id})">
                                <i class="fas fa-comments me-1"></i>Chat
                            </button>
                            ${calendarButton}
                        </div>
                    </article>
                </div>
            `;
        }).join('');
    }

    window.openChatWithStudent = async function(userId) {
        try {
            const res = await fetch('/api/chats', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${auth.getToken()}`
                },
                body: JSON.stringify({ type: 'friend', friendId: Number(userId) })
            });
            if (res.status === 401) return auth.logout();
            const data = await res.json();
            if (res.ok && data.conversation_id) {
                window.location.href = `chat.html?conversationId=${data.conversation_id}`;
                return;
            }
            showThemedAlert(data.message || 'Chat is available after the match is accepted.', {
                title: 'Chat Not Available',
                tone: 'warning',
            });
        } catch (err) {
            showThemedAlert('Network error opening chat.', {
                title: 'Connection Issue',
                tone: 'danger',
            });
        }
    };

    function setStudentSavedState(userId, isSaved) {
        const numericId = Number(userId);
        allStudents = allStudents.map(student => (
            Number(student.user_id) === numericId
                ? { ...student, is_saved: isSaved }
                : student
        ));

        if (isSaved) {
            const student = getStudentById(numericId);
            if (student && !savedStudents.some(saved => Number(saved.user_id) === numericId)) {
                savedStudents = [{ ...student, is_saved: true }, ...savedStudents];
            }
        } else {
            savedStudents = savedStudents.filter(student => Number(student.user_id) !== numericId);
        }
    }

    function removeStudentFromMatchmaking(userId) {
        const numericId = Number(userId);
        allStudents = allStudents.filter(student => Number(student.user_id) !== numericId);
        savedStudents = savedStudents.filter(student => Number(student.user_id) !== numericId);
        compareSelection = compareSelection.filter(id => Number(id) !== numericId);
        window.filterStudents(false);
        refreshCompareUI();
    }

    async function sendStudentAction(url, options = {}) {
        const res = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth.getToken()}`,
                ...(options.headers || {}),
            },
        });
        if (res.status === 401) {
            auth.logout();
            return { ok: false, data: { message: 'Session expired' } };
        }
        let data = {};
        try {
            data = await res.json();
        } catch {
            data = {};
        }
        return { ok: res.ok, data };
    }

    window.toggleSavedStudent = async function(userId) {
        const student = getStudentById(userId);
        if (!student) return;

        const shouldSave = !student.is_saved;
        try {
            const result = await sendStudentAction(`/api/matches/saved/${userId}`, {
                method: shouldSave ? 'POST' : 'DELETE',
            });

            if (!result.ok) {
                showThemedAlert(result.data.message || 'Unable to update shortlist.', {
                    title: 'Shortlist Not Updated',
                    tone: 'warning',
                });
                return;
            }

            setStudentSavedState(userId, shouldSave);
            window.filterStudents(false);
            const modalSaveBtn = document.getElementById('modalSaveBtn');
            if (modalSaveBtn && Number(modalSaveBtn.dataset.userId) === Number(userId)) {
                updateModalSaveButton(student.user_id);
            }
        } catch {
            showThemedAlert('Network error updating shortlist.', {
                title: 'Connection Issue',
                tone: 'danger',
            });
        }
    };

    window.hideMatchStudent = function(userId) {
        const student = getStudentById(userId);
        const name = student?.name || 'this student';
        closeStudentProfileModal(() => {
            showConfirm(`Hide ${name} from your matchmaking recommendations?`, async () => {
                try {
                    const result = await sendStudentAction(`/api/matches/hidden/${userId}`, {
                        method: 'POST',
                        body: JSON.stringify({ reason: 'Not a suitable match' }),
                    });
                    if (!result.ok) {
                        showThemedAlert(result.data.message || 'Unable to hide this student.', {
                            title: 'Student Not Hidden',
                            tone: 'warning',
                        });
                        return;
                    }
                    removeStudentFromMatchmaking(userId);
                    showSuccess('Student hidden from your matchmaking recommendations.');
                } catch {
                    showThemedAlert('Network error hiding student.', {
                        title: 'Connection Issue',
                        tone: 'danger',
                    });
                }
            }, {
                title: 'Hide Student',
                confirmText: 'Hide',
            });
        });
    };

    window.blockMatchStudent = function(userId) {
        const student = getStudentById(userId);
        const name = student?.name || 'this student';
        closeStudentProfileModal(() => {
            showConfirm(`Block ${name}? They will no longer appear in matchmaking and match requests will be blocked.`, async () => {
                try {
                    const result = await sendStudentAction(`/api/matches/blocked/${userId}`, {
                        method: 'POST',
                        body: JSON.stringify({ reason: 'Blocked from matchmaking' }),
                    });
                    if (!result.ok) {
                        showThemedAlert(result.data.message || 'Unable to block this student.', {
                            title: 'Student Not Blocked',
                            tone: 'warning',
                        });
                        return;
                    }
                    removeStudentFromMatchmaking(userId);
                    showSuccess('Student blocked from matchmaking.');
                } catch {
                    showThemedAlert('Network error blocking student.', {
                        title: 'Connection Issue',
                        tone: 'danger',
                    });
                }
            }, {
                title: 'Block Student',
                confirmText: 'Block',
                confirmClass: 'btn-danger',
            });
        });
    };

    window.openReportStudentDialog = function(userId) {
        closeStudentProfileModal(() => {
            showReportStudentDialog(userId);
        });
    };

    function showReportStudentDialog(userId) {
        const student = getStudentById(userId);
        const name = student?.name || 'this student';
        const old = document.getElementById('reportStudentModal');
        if (old) old.remove();

        const modalHtml = `
            <div class="modal fade" id="reportStudentModal" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content border-0 rounded-4 shadow-lg">
                        <div class="modal-header border-0 pb-0">
                            <div>
                                <h5 class="modal-title fw-bold">Report ${escapeHTML(name)}</h5>
                                <p class="text-muted small mb-0">The student will also be hidden from your matchmaking list.</p>
                            </div>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body pt-3">
                            <label class="form-label small fw-bold text-muted uppercase" for="reportReason">Reason</label>
                            <select id="reportReason" class="form-select rounded-4 border-0 bg-light py-3 mb-3">
                                <option value="">Choose a reason</option>
                                <option value="Spam or fake profile">Spam or fake profile</option>
                                <option value="Inappropriate behavior">Inappropriate behavior</option>
                                <option value="Harassment or bullying">Harassment or bullying</option>
                                <option value="Unsafe or suspicious request">Unsafe or suspicious request</option>
                                <option value="Other">Other</option>
                            </select>
                            <label class="form-label small fw-bold text-muted uppercase" for="reportDetails">Details</label>
                            <textarea id="reportDetails" class="form-control rounded-4 border-0 bg-light" rows="4" placeholder="Add context for the report..."></textarea>
                            <div class="invalid-feedback d-block mt-2 d-none" id="reportReasonError">Please choose a reason.</div>
                            <div class="invalid-feedback d-block mt-2 d-none" id="reportDetailsError">Please add details when choosing Other.</div>
                        </div>
                        <div class="modal-footer border-0 pt-0">
                            <button type="button" class="btn btn-white rounded-4 fw-bold" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-danger rounded-4 fw-bold" id="submitReportStudentBtn">
                                <i class="fas fa-flag me-1"></i>Submit Report
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modalEl = document.getElementById('reportStudentModal');
        const modal = new bootstrap.Modal(modalEl);
        modalEl.addEventListener('hidden.bs.modal', () => modalEl.remove(), { once: true });

        document.getElementById('submitReportStudentBtn').onclick = async () => {
            const reason = document.getElementById('reportReason').value;
            const details = document.getElementById('reportDetails').value.trim();
            const reasonError = document.getElementById('reportReasonError');
            const detailsError = document.getElementById('reportDetailsError');
            if (!reason) {
                reasonError.classList.remove('d-none');
                detailsError.classList.add('d-none');
                return;
            }
            if (reason === 'Other' && !details) {
                reasonError.classList.add('d-none');
                detailsError.classList.remove('d-none');
                return;
            }
            reasonError.classList.add('d-none');
            detailsError.classList.add('d-none');

            try {
                const result = await sendStudentAction(`/api/matches/reports/${userId}`, {
                    method: 'POST',
                    body: JSON.stringify({ reason, details }),
                });
                if (!result.ok) {
                    showThemedAlert(result.data.message || 'Unable to submit report.', {
                        title: 'Report Not Submitted',
                        tone: 'warning',
                    });
                    return;
                }
                modal.hide();
                closeStudentProfileModal();
                removeStudentFromMatchmaking(userId);
                showSuccess('Report submitted. The student has been hidden from matchmaking.');
            } catch {
                showThemedAlert('Network error submitting report.', {
                    title: 'Connection Issue',
                    tone: 'danger',
                });
            }
        };

        modal.show();
    }

    function updateModalSaveButton(userId) {
        const student = getStudentById(userId);
        const saveBtn = document.getElementById('modalSaveBtn');
        if (!student || !saveBtn) return;
        const isSaved = Boolean(student.is_saved);
        saveBtn.dataset.userId = String(student.user_id);
        saveBtn.className = `btn ${isSaved ? 'btn-primary' : 'btn-outline-primary'} rounded-4 fw-bold uppercase small`;
        saveBtn.innerHTML = `<i class="${isSaved ? 'fas' : 'far'} fa-bookmark me-1"></i>${isSaved ? 'Saved' : 'Save'}`;
        saveBtn.onclick = () => window.toggleSavedStudent(student.user_id);
    }

    function closeStudentProfileModal(callback) {
        const profileModalEl = document.getElementById('studentProfileModal');
        const modal = bootstrap.Modal.getInstance(profileModalEl);
        if (modal && profileModalEl.classList.contains('show')) {
            if (callback) profileModalEl.addEventListener('hidden.bs.modal', callback, { once: true });
            modal.hide();
            return;
        }
        if (callback) callback();
    }

    const dayNames = {
        sun: 'Sunday',
        mon: 'Monday',
        tue: 'Tuesday',
        wed: 'Wednesday',
        thu: 'Thursday',
        fri: 'Friday',
        sat: 'Saturday',
    };
    const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const timeCategoryMap = {
        morning: '09:00',
        afternoon: '14:00',
        evening: '18:00',
    };

    function toLowerList(value) {
        return normalizeList(value).map(item => item.toLowerCase());
    }

    function getDateInputValue(date) {
        return [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, '0'),
            String(date.getDate()).padStart(2, '0'),
        ].join('-');
    }

    function buildScheduleSuggestions(student) {
        if (!student) return { source: 'No partner selected', slots: [] };

        const myDays = toLowerList(userPreferences.availability_days);
        const peerDays = toLowerList(student.availability_days);
        const sharedDays = myDays.filter(day => peerDays.includes(day));
        let days = sharedDays;
        let source = 'Shared availability';

        if (days.length === 0) {
            if (myDays.length > 0) {
                days = myDays;
                source = 'Your saved availability';
            } else if (peerDays.length > 0) {
                days = peerDays;
                source = 'Partner availability';
            }
        }

        const myTimes = toLowerList(userPreferences.selected_times);
        const peerTimes = toLowerList(student.selected_times);
        const sharedTimes = myTimes.filter(time => peerTimes.includes(time));
        let timeValues = sharedTimes;

        if (timeValues.length === 0) {
            timeValues = myTimes.length > 0 ? myTimes : peerTimes;
        }

        const exactTimes = [
            userPreferences.start_time,
            student.start_time,
        ].filter(Boolean);

        const slots = [];
        const today = new Date();
        const datesToCheck = [];

        for (let offset = 0; offset < 28; offset += 1) {
            const candidate = new Date(today);
            candidate.setDate(today.getDate() + offset);
            const key = dayKeys[candidate.getDay()];
            if (days.length === 0 || days.includes(key)) {
                datesToCheck.push({ date: candidate, dayKey: key });
            }
            if (datesToCheck.length >= 10) break;
        }

        const candidateTimes = exactTimes.length > 0
            ? exactTimes
            : timeValues.map(time => timeCategoryMap[time]).filter(Boolean);

        datesToCheck.forEach(({ date, dayKey }) => {
            candidateTimes.forEach(time => {
                if (!time) return;
                const dateValue = getDateInputValue(date);
                const dateTime = new Date(`${dateValue}T${time}`);
                if (dateTime <= today) return;
                slots.push({
                    date: dateValue,
                    time,
                    label: `${dayNames[dayKey] || cap(dayKey)}, ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
                });
            });
        });

        return {
            source,
            slots: slots.slice(0, 4),
        };
    }

    function renderScheduleSuggestions(student) {
        const wrap = document.getElementById('scheduleSuggestionsWrap');
        const list = document.getElementById('scheduleSuggestions');
        const sourceEl = document.getElementById('scheduleSuggestionSource');
        if (!wrap || !list) return;

        const { source, slots } = buildScheduleSuggestions(student);
        wrap.style.display = 'block';
        if (sourceEl) sourceEl.innerText = source;

        if (slots.length === 0) {
            list.innerHTML = `
                <div class="schedule-suggestion-empty">
                    No saved availability overlap yet. Pick any date and time manually.
                </div>
            `;
            return;
        }

        list.innerHTML = slots.map(slot => `
            <button type="button" class="schedule-suggestion-btn" onclick="window.applyScheduleSuggestion('${slot.date}', '${slot.time}')">
                <span>${escapeHTML(slot.label)}</span>
                <strong>${escapeHTML(slot.time)}</strong>
            </button>
        `).join('');
    }

    window.applyScheduleSuggestion = function(date, time) {
        const dateInput = document.getElementById('reqDate');
        const timeInput = document.getElementById('reqTime');
        if (dateInput) dateInput.value = date;
        if (timeInput) timeInput.value = time;
        clearMatchErrors();
    };

    function getCompareRows(student) {
        const sharedModules = getSharedModuleCodes(student);
        const peerDays = normalizeList(student.availability_days);
        const peerTimes = normalizeList(student.selected_times);
        const peerModes = normalizeList(student.selected_modes);
        const peerStyles = normalizeList(student.style);
        const peerLanguages = normalizeList(student.selected_languages);

        const myDays = normalizeList(userPreferences.availability_days);
        const myTimes = normalizeList(userPreferences.selected_times);
        const myModes = normalizeList(userPreferences.selected_modes);
        const myStyles = normalizeList(userPreferences.style);
        const myLanguages = normalizeList(userPreferences.selected_languages);

        const sharedDays = getOverlap(myDays, peerDays);
        const sharedTimes = getOverlap(myTimes, peerTimes);
        const sharedModes = getOverlap(myModes, peerModes);
        const sharedStyles = getOverlap(myStyles, peerStyles);
        const sharedLanguages = getOverlap(myLanguages, peerLanguages);

        return [
            {
                icon: 'fa-book-open',
                label: 'Shared modules',
                value: sharedModules.length ? sharedModules.join(', ') : 'No shared modules',
                positive: sharedModules.length > 0
            },
            {
                icon: 'fa-calendar-check',
                label: 'Schedule overlap',
                value: sharedDays.length || sharedTimes.length
                    ? [summarizeList(sharedDays, ''), summarizeList(sharedTimes, '')].filter(Boolean).join(' / ')
                    : 'No overlap set',
                positive: sharedDays.length > 0 || sharedTimes.length > 0
            },
            {
                icon: 'fa-house-laptop',
                label: 'Preferred mode',
                value: sharedModes.length ? summarizeList(sharedModes) : summarizeList(peerModes, 'Flexible'),
                positive: sharedModes.length > 0
            },
            {
                icon: 'fa-brain',
                label: 'Study style',
                value: sharedStyles.length ? summarizeList(sharedStyles) : summarizeList(peerStyles, 'Flexible'),
                positive: sharedStyles.length > 0
            },
            {
                icon: 'fa-language',
                label: 'Languages',
                value: sharedLanguages.length ? summarizeList(sharedLanguages) : summarizeList(peerLanguages, 'Not set'),
                positive: sharedLanguages.length > 0
            }
        ];
    }

    function renderCompareCard(student) {
        const matchScore = getMatchScore(student);
        const modules = getStudentModules(student);
        const moduleTags = modules.slice(0, 5).map(m => `<span class="module-tag">${escapeHTML(m)}</span>`).join(' ');
        const rows = getCompareRows(student);
        const statusLabel = student.request_status ? escapeHTML(student.request_status) : 'Available';
        const statusClass = student.request_status === 'Accepted'
            ? 'compare-status-success'
            : student.request_status === 'Pending'
                ? 'compare-status-pending'
                : 'compare-status-neutral';

        return `
            <div class="compare-student-card">
                <button type="button" class="compare-remove-btn" onclick="window.removeCompareStudent(${student.user_id})" aria-label="Remove ${escapeHTML(student.name)} from comparison">
                    <i class="fas fa-times"></i>
                </button>

                <div class="d-flex align-items-center gap-3 mb-4">
                    <div class="compare-card-avatar rounded-circle overflow-hidden">
                        ${getAvatarHTML(student.profile_pic, student.name)}
                    </div>
                    <div class="min-w-0">
                        <h5 class="fw-bold mb-1 text-truncate">${escapeHTML(student.name)}</h5>
                        <p class="text-muted small fw-bold uppercase tracking-wider mb-0">
                            Year ${escapeHTML(student.year || 2)} - ${escapeHTML(student.diploma_code || 'DIT')}
                        </p>
                    </div>
                </div>

                <div class="compare-score-wrap mb-4">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <span class="small fw-bold text-muted uppercase">Match score</span>
                        <span class="compare-score-value">${matchScore}%</span>
                    </div>
                    <div class="compare-score-track">
                        <div class="compare-score-fill" style="width: ${matchScore}%"></div>
                    </div>
                </div>

                <div class="compare-module-block mb-4">
                    <div class="small fw-bold text-muted uppercase mb-2">Modules</div>
                    <div class="d-flex flex-wrap gap-1">
                        ${moduleTags || '<span class="text-muted small">No modules listed</span>'}
                    </div>
                </div>

                <div class="compare-fact-list mb-4">
                    ${rows.map(row => `
                        <div class="compare-fact-row ${row.positive ? 'is-positive' : ''}">
                            <i class="fas ${row.icon}"></i>
                            <div>
                                <div class="compare-fact-label">${escapeHTML(row.label)}</div>
                                <div class="compare-fact-value">${escapeHTML(row.value)}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <div class="compare-status ${statusClass} mb-3">${statusLabel}</div>

                <div class="d-flex gap-2 mt-auto">
                    ${getProfileButtonHTML(student.user_id, 'btn btn-white flex-grow-1 py-2 rounded-4 fw-bold small')}
                    ${getConnectButtonHTML(student, 'btn btn-primary flex-grow-1 py-2 rounded-4 fw-bold small')}
                </div>
            </div>
        `;
    }

    function renderCompareModal() {
        const content = document.getElementById('compareModalContent');
        if (!content) return;
        const selectedStudents = getComparedStudents();

        if (selectedStudents.length < 2) {
            content.innerHTML = `
                <div class="compare-empty-state text-center py-5">
                    <div class="compare-empty-icon mx-auto mb-3">
                        <i class="fas fa-code-compare"></i>
                    </div>
                    <h4 class="fw-bold mb-2">Pick at least two students</h4>
                    <p class="text-muted mb-0">Use the Compare button on student cards to build a short list.</p>
                </div>
            `;
            return;
        }

        content.innerHTML = selectedStudents.map(renderCompareCard).join('');
    }

    function refreshCompareUI() {
        compareSelection = getComparedStudents().map(student => Number(student.user_id));

        document.querySelectorAll('[data-compare-id]').forEach(button => {
            const isSelected = compareSelection.includes(Number(button.dataset.compareId));
            const isIconButton = button.classList.contains('match-card-icon-btn');
            button.classList.toggle('is-selected', isSelected);
            button.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
            button.setAttribute('title', isSelected ? 'Selected for compare' : 'Compare');
            button.setAttribute('aria-label', isSelected ? 'Selected for compare' : 'Compare');
            if (isIconButton) {
                button.innerHTML = isSelected
                    ? '<i class="fas fa-check"></i>'
                    : '<i class="fas fa-code-compare"></i>';
            } else {
                button.innerHTML = isSelected
                    ? '<i class="fas fa-check me-1"></i>Selected'
                    : '<i class="fas fa-code-compare me-1"></i>Compare';
            }
        });

        const tray = document.getElementById('compareTray');
        if (!tray) return;

        const selectedStudents = getComparedStudents();
        tray.style.display = selectedStudents.length > 0 ? 'flex' : 'none';

        const namesEl = document.getElementById('compareTrayNames');
        if (namesEl) {
            namesEl.innerText = selectedStudents.length
                ? selectedStudents.map(student => student.name).join(', ')
                : 'Select 2 to 3 students';
        }

        const avatarEl = document.getElementById('compareTrayAvatars');
        if (avatarEl) {
            avatarEl.innerHTML = selectedStudents.map(student => `
                <div class="compare-tray-avatar rounded-circle overflow-hidden" title="${escapeHTML(student.name)}">
                    ${getAvatarHTML(student.profile_pic, student.name)}
                </div>
            `).join('');
        }

        const openBtn = document.getElementById('compareOpenBtn');
        if (openBtn) {
            const canCompare = selectedStudents.length >= 2;
            openBtn.disabled = !canCompare;
            openBtn.innerText = canCompare ? `Compare ${selectedStudents.length}` : 'Pick 1 more';
        }

        const modalEl = document.getElementById('compareModal');
        if (modalEl && modalEl.classList.contains('show')) renderCompareModal();
    }

    window.toggleCompareStudent = function(userId) {
        const numericId = Number(userId);
        if (compareSelection.includes(numericId)) {
            compareSelection = compareSelection.filter(id => id !== numericId);
        } else if (compareSelection.length >= MAX_COMPARE_STUDENTS) {
            showThemedAlert(`You can compare up to ${MAX_COMPARE_STUDENTS} students at once.`, {
                title: 'Compare Limit Reached',
                tone: 'info',
            });
            return;
        } else {
            compareSelection.push(numericId);
        }

        refreshCompareUI();
    };

    window.removeCompareStudent = function(userId) {
        compareSelection = compareSelection.filter(id => id !== Number(userId));
        refreshCompareUI();
    };

    window.clearCompareSelection = function() {
        compareSelection = [];
        refreshCompareUI();
    };

    window.openCompareModal = function() {
        renderCompareModal();
        const modal = new bootstrap.Modal(document.getElementById('compareModal'));
        modal.show();
    };

    function closeCompareModalIfOpen() {
        const compareModalEl = document.getElementById('compareModal');
        if (!compareModalEl || !compareModalEl.classList.contains('show')) {
            return Promise.resolve();
        }

        return new Promise(resolve => {
            compareModalEl.addEventListener('hidden.bs.modal', resolve, { once: true });
            const compareModal = bootstrap.Modal.getInstance(compareModalEl) || new bootstrap.Modal(compareModalEl);
            compareModal.hide();
        });
    }

    function renderStudents(students) {
        const grid = document.getElementById('studentGrid');
        if (!grid) return;
        grid.innerHTML = '';
        if (students.length === 0) {
            const savedOnly = document.getElementById('savedOnlyFilter')?.checked || false;
            const message = savedOnly
                ? 'No saved students yet. Save a profile to build your shortlist.'
                : 'No available matches found. Try adjusting your preferences.';
            grid.innerHTML = `<div class="col-12 text-center py-5"><p class="text-muted">${message}</p></div>`;
            refreshCompareUI();
            return;
        }

        const sorted = [...students];

        const bestMatch = sorted[0];
        const recommended = sorted.slice(1);

        let html = '';

        if (bestMatch) {
            const matchScore = getMatchScore(bestMatch);
            const studentModules = (bestMatch.modules || '').split(',').filter(m => m.trim().length > 0);
            const moduleTagsHTML = studentModules.map(m => `<span class="module-tag">${escapeHTML(m.trim())}</span>`).join(' ');
            
            html += `
                <div class="col-12 mb-4">
                    <div class="match-hero-card position-relative overflow-hidden">
                        <div class="match-hero-halo"></div>
                        
                        <div class="row g-4 position-relative match-hero-content">
                            <!-- Profile Details Column -->
                            <div class="col-lg-5 border-end-lg match-hero-profile">
                                <div class="match-hero-badge-wrap d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
                                    <span class="badge match-hero-tag px-3 py-2 rounded-pill"><i class="fas fa-star me-1"></i> BEST MATCH</span>
                                    <div class="match-hero-score px-3 py-2 rounded-3">${matchScore}% Match</div>
                                </div>
                                
                                <div class="match-hero-identity d-flex align-items-center gap-3 mb-3">
                                    <div class="match-hero-avatar-container">
                                        <div class="match-hero-avatar rounded-circle overflow-hidden w-100 h-100 bg-light border-0">
                                            ${getAvatarHTML(bestMatch.profile_pic, bestMatch.name)}
                                        </div>
                                        ${bestMatch.is_online ? '<span class="online-dot"></span>' : ''}
                                    </div>
                                    <div class="match-hero-info">
                                        <h3 class="fw-bold mb-1 match-hero-name">${escapeHTML(bestMatch.name)}</h3>
                                        <p class="fw-bold small uppercase tracking-wider mb-0 match-hero-course">Year ${escapeHTML(bestMatch.year || 2)} - ${escapeHTML(bestMatch.diploma_name || 'Diploma in IT')}</p>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Shared Modules Column -->
                            <div class="col-lg-3 border-end-lg d-flex flex-column justify-content-center match-hero-modules">
                                <span class="small fw-bold uppercase tracking-wider mb-2 d-block match-hero-modules-label">SHARED MODULES</span>
                                <div class="flex-wrap gap-2 mb-3 d-flex match-hero-modules-list">
                                    ${moduleTagsHTML || '<span class="text-muted small">No modules enrolled</span>'}
                                </div>
                                <p class="match-hero-quote small mb-0 mt-2">${escapeHTML(getMatchSummary(bestMatch))}</p>
                            </div>
                            
                            <!-- Actions Column -->
                            <div class="col-lg-4 d-flex align-items-center">
                                <div class="match-hero-actions-stack">
                                    <div class="match-hero-secondary-actions">
                                        ${getSaveButtonHTML(bestMatch, 'btn btn-white py-2 rounded-4 fw-bold shadow-xs')}
                                        ${getCompareButtonHTML(bestMatch, 'btn btn-white py-2 rounded-4 fw-bold shadow-xs')}
                                    </div>
                                    ${getProfileButtonHTML(bestMatch.user_id, 'btn btn-white w-100 py-2 rounded-4 fw-bold shadow-xs', 'View Profile')}
                                    ${getConnectButtonHTML(bestMatch, 'btn btn-accent w-100 py-2 rounded-4 fw-bold shadow-soft')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        if (recommended.length > 0) {
            html += `
                <div class="col-12 mt-2 mb-2">
                    <h5 class="fw-bold text-muted uppercase tracking-wider mb-0" style="font-size: 0.8rem; letter-spacing: 0.05em;">RECOMMENDED FOR YOU</h5>
                </div>
            `;

            const slicedRecommended = recommended.slice(0, visibleMatchesCount - 1);
            slicedRecommended.forEach((s) => {
                const matchScore = getMatchScore(s);
                const studentModules = (s.modules || '')
                    .split(',')
                    .filter((m) => m.trim().length > 0);
                const moduleTagsHTML = studentModules
                    .slice(0, 3)
                    .map((m) => `<span class="module-tag">${escapeHTML(m.trim())}</span>`)
                    .join(' ');
                const cardSummary = getStudentCardSummary(s);

                html += `
                    <div class="col-md-6 col-xl-4">
                        <div class="student-card h-100 d-flex flex-column justify-content-between">
                            <div>
                                <div class="d-flex align-items-start justify-content-between mb-3 gap-2">
                                    <div class="d-flex align-items-center gap-3">
                                        <div class="position-relative" style="width: 56px; height: 56px; min-width: 56px;">
                                            <div class="avatar-wrap rounded-circle overflow-hidden w-100 h-100 bg-light border-0">
                                                ${getAvatarHTML(s.profile_pic, s.name)}
                                            </div>
                                            ${s.is_online ? '<span class="online-dot"></span>' : ''}
                                        </div>
                                        <div>
                                            <h5 class="fw-bold text-dark mb-1 fs-6">${escapeHTML(s.name)}</h5>
                                            <p class="text-muted fw-bold small uppercase tracking-wider mb-0" style="font-size: 9px; letter-spacing: 0.02em;">Year ${escapeHTML(s.year || 2)} - ${escapeHTML(s.diploma_code || 'DIT')}</p>
                                        </div>
                                    </div>
                                    <div class="match-score">${matchScore}%</div>
                                </div>
                                
                                <div class="mt-3">
                                    <span class="text-muted small fw-bold uppercase tracking-wider mb-2 d-block" style="font-size: 8px; letter-spacing: 0.05em;">SHARED MODULES</span>
                                    <div class="flex-wrap gap-1 mb-2 d-flex">
                                        ${moduleTagsHTML || '<span class="text-muted small">No modules</span>'}
                                    </div>
                                    <p class="student-card-summary my-2">${escapeHTML(cardSummary)}</p>
                                </div>
                            </div>

                            <div class="d-grid gap-2">
                                <div class="match-card-actions-row">
                                    ${getProfileIconButtonHTML(s.user_id)}
                                    ${getSaveIconButtonHTML(s)}
                                    ${getCompareIconButtonHTML(s)}
                                </div>
                                ${getConnectButtonHTML(s, 'btn btn-primary py-1 rounded-4 fw-bold w-100 small')}
                            </div>
                        </div>
                    </div>
                `;
            });

            if (recommended.length > visibleMatchesCount - 1) {
                html += `
                    <div class="col-12 text-center mt-5 mb-2" id="peersLoadMoreContainer">
                        <button class="btn btn-outline-primary px-5 py-3 rounded-4 fw-bold shadow-sm" onclick="window.loadMorePeers()">
                            <i class="fas fa-sync-alt me-2"></i>SHOW MORE PEERS
                        </button>
                    </div>
                `;
            }
        }

        grid.innerHTML = html;
        refreshCompareUI();
    }

    function toggleAutoMatchVisibility() {
        const toggle = document.getElementById('autoMatchEnabled');
        const container = document.getElementById('autoMatchSettingsContainer');
        if (toggle && container) {
            const isEnabled = toggle.checked;
            container.style.setProperty('display', isEnabled ? 'block' : 'none', 'important');
            
            // Reset fields if disabled
            if (!isEnabled) {
                // Reset match rate
                document.getElementById('ratemanual').checked = true;
                // Reset study styles
                document.querySelectorAll('[id^="style"]').forEach(el => el.checked = false);
                document.getElementById('stylediscussion').checked = true;
                // Reset duration & priority
                const dur = document.getElementById('prefDuration');
                if (dur) { dur.value = 60; document.getElementById('durationVal').innerText = 60; }
                const pri = document.getElementById('prefPriority');
                if (pri) { pri.value = 50; document.getElementById('priorityVal').innerText = 50; }
                // Reset gender
                document.getElementById('genderany').checked = true;
                // Reset languages
                const langSelect = document.getElementById('prefLanguages');
                if (langSelect) Array.from(langSelect.options).forEach(opt => opt.selected = false);
            }
        }
    }

    function setupEventListeners() {
        const form = document.getElementById('preferencesForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                savePreferences();
            });
        }
        const autoMatchToggle = document.getElementById('autoMatchEnabled');
        if (autoMatchToggle) {
            autoMatchToggle.addEventListener('change', toggleAutoMatchVisibility);
        }

        const matchForm = document.getElementById('matchRequestForm');
        if (matchForm) {
            matchForm.addEventListener('submit', (e) => {
                e.preventDefault();
                sendMatchRequest();
            });
        }

        const reqTypeEl = document.getElementById('reqType');
        const coPartGroupEl = document.getElementById('coParticipantsGroup');
        if (reqTypeEl && coPartGroupEl) {
            reqTypeEl.addEventListener('change', (e) => {
                if (e.target.value === 'group') {
                    coPartGroupEl.classList.remove('d-none');
                } else {
                    coPartGroupEl.classList.add('d-none');
                    const select = document.getElementById('reqCoParticipants');
                    if (select) Array.from(select.options).forEach(opt => opt.selected = false);
                }
            });
        }

        const modalEl = document.getElementById('preferencesModal');
        if (modalEl) {
            modalEl.addEventListener('show.bs.modal', function () {
                const firstTabEl = document.querySelector('#pref-tabs button[data-bs-target="#pref-summary"]');
                if (firstTabEl) {
                    const tab = new bootstrap.Tab(firstTabEl);
                    tab.show();
                }
                
                renderPreferences();
            });
        }
    }

    let sentOffset = 0;
    let receivedOffset = 0;
    const PAGE_LIMIT = 6;

    async function loadRequests(isLoadMore = false, type = 'both') {
        try {
            loadActiveMatchesDashboard();
            if (!isLoadMore) {
                if (type === 'both' || type === 'received') receivedOffset = 0;
                if (type === 'both' || type === 'sent') sentOffset = 0;
            }

            const token = auth.getToken();
            const headers = { 'Authorization': `Bearer ${token}` };

            const promises = [];
            if (type === 'both' || type === 'received') {
                promises.push(fetch(`/api/matches/requests/received?limit=${PAGE_LIMIT}&offset=${receivedOffset}`, { headers }).then(r => r.json()));
            } else {
                promises.push(Promise.resolve(null));
            }

            if (type === 'both' || type === 'sent') {
                promises.push(fetch(`/api/matches/requests/sent?limit=${PAGE_LIMIT}&offset=${sentOffset}`, { headers }).then(r => r.json()));
            } else {
                promises.push(Promise.resolve(null));
            }

            const [received, sent] = await Promise.all(promises);

            if (received) {
                const container = document.getElementById('receivedRequests');
                const countEl = document.getElementById('receivedCount');
                if (!isLoadMore) container.innerHTML = '';
                
                const list = Array.isArray(received) ? received : [];
                let total = list.length > 0 && list[0].total_count !== undefined ? parseInt(list[0].total_count, 10) : receivedOffset + list.length;
                let pending = list.length > 0 && list[0].pending_count !== undefined ? parseInt(list[0].pending_count, 10) : list.filter(r => r.status === 'Pending').length;
                
                if (list.length === 0 && !isLoadMore) {
                    container.innerHTML = '<div class="col-12 text-center p-5"><p class="text-muted">No requests received yet.</p></div>';
                } else {
                    list.forEach(req => container.innerHTML += renderRequestCard(req, 'received'));
                }
                
                document.getElementById('receivedLoadMore').style.display = (receivedOffset + list.length < total) ? 'block' : 'none';
                
                if (!isLoadMore || list.length > 0) {
                    countEl.innerText = pending;
                    if (pending === 0) countEl.style.display = 'none';
                    else countEl.style.display = 'inline-block';
                }
            }

            if (sent) {
                const container = document.getElementById('sentRequests');
                const countEl = document.getElementById('sentCount');
                if (!isLoadMore) container.innerHTML = '';
                
                const list = Array.isArray(sent) ? sent : [];
                let total = list.length > 0 && list[0].total_count !== undefined ? parseInt(list[0].total_count, 10) : sentOffset + list.length;
                let pending = list.length > 0 && list[0].pending_count !== undefined ? parseInt(list[0].pending_count, 10) : list.filter(r => r.status === 'Pending').length;
                
                if (list.length === 0 && !isLoadMore) {
                    container.innerHTML = '<div class="col-12 text-center p-5"><p class="text-muted">No requests sent yet.</p></div>';
                } else {
                    list.forEach(req => container.innerHTML += renderRequestCard(req, 'sent'));
                }
                
                document.getElementById('sentLoadMore').style.display = (sentOffset + list.length < total) ? 'block' : 'none';
                
                if (!isLoadMore || list.length > 0) {
                    countEl.innerText = pending;
                    if (pending === 0) countEl.style.display = 'none';
                    else countEl.style.display = 'inline-block';
                }
            }

        } catch (err) {
            console.error('Error loading requests:', err);
        }
    }

    window.loadMoreRequests = function(type) {
        if (type === 'received') {
            receivedOffset += PAGE_LIMIT;
            loadRequests(true, 'received');
        } else {
            sentOffset += PAGE_LIMIT;
            loadRequests(true, 'sent');
        }
    };

    function formatDisplayDate(dateStr) {
        if (!dateStr) return 'N/A';
        const datePart = String(dateStr).replace('T', ' ').split(' ')[0];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        if (datePart.includes('-')) {
            // YYYY-MM-DD
            const parts = datePart.split('-');
            if (parts.length === 3) return `${parts[2]} ${months[parseInt(parts[1], 10) - 1]} ${parts[0]}`;
        } else if (datePart.includes('/')) {
            // DD/MM/YYYY
            const parts = datePart.split('/');
            if (parts.length === 3) return `${parts[0]} ${months[parseInt(parts[1], 10) - 1]} ${parts[2]}`;
        }
        return datePart;
    }

    window.confirmUpdateStatus = function(id, status) {
        const statusMap = { 'Cancelled': 'cancel', 'Declined': 'decline', 'Accepted': 'accept' };
        const action = statusMap[status] || status.toLowerCase();
        
        const isPositive = status === 'Accepted';
        const title = isPositive ? 'CONFIRMATION' : 'WARNING';
        const icon = isPositive ? 'fa-check-circle text-success' : 'fa-exclamation-triangle text-warning';
        const btnClass = isPositive ? 'btn-success' : 'btn-danger';

        const modalHtml = `
        <div class="modal fade" id="dynamicConfirmModal" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content border-0 rounded-4 shadow-lg">
                    <div class="modal-body p-5 text-center">
                        <i class="fas ${icon} fa-3x mb-4"></i>
                        <h4 class="fw-bold mb-3">${title}</h4>
                        <p class="text-muted mb-4">Do you really want to ${action} this request?</p>
                        <div class="d-flex gap-2 justify-content-center">
                            <button type="button" class="btn btn-light px-4 py-2 rounded-pill fw-bold border" data-bs-dismiss="modal">GO BACK</button>
                            <button type="button" class="btn ${btnClass} px-4 py-2 rounded-pill fw-bold" id="confirmActionBtn">CONFIRM</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
        
        const old = document.getElementById('dynamicConfirmModal');
        if (old) old.remove();
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modalEl = document.getElementById('dynamicConfirmModal');
        const modal = new bootstrap.Modal(modalEl);
        
        document.getElementById('confirmActionBtn').onclick = () => {
            modal.hide();
            window.updateRequestStatus(id, status);
        };
        
        modal.show();
    };

    function renderRequestCard(req, type) {
        const isReceived = type === 'received';
        const name = isReceived ? (req.sender_name || 'User') : (req.receiver_name || 'User');
        const pic = isReceived ? req.sender_pic : req.receiver_pic;
        const username = isReceived ? req.sender_username : req.receiver_username;
        const otherId = isReceived ? req.sender_id : req.receiver_id;
        
        // Status config
        const statusMap = {
            'Accepted':  { cls: 'req-card-accepted',  badge: 'req-badge-accepted',  icon: 'fa-check-circle',  label: 'Accepted'  },
            'Rejected':  { cls: 'req-card-declined',  badge: 'req-badge-declined',  icon: 'fa-times-circle',  label: 'Declined'  },
            'Declined':  { cls: 'req-card-declined',  badge: 'req-badge-declined',  icon: 'fa-times-circle',  label: 'Declined'  },
            'Cancelled': { cls: 'req-card-declined',  badge: 'req-badge-declined',  icon: 'fa-ban',           label: 'Cancelled' },
            'Pending':   { cls: 'req-card-pending',   badge: 'req-badge-pending',   icon: 'fa-clock',         label: 'Pending'   },
        };
        const s = statusMap[req.status] || statusMap['Pending'];

        const sessionType = req.type === 'group' ? 'Group Study' : '1-on-1';
        const dateStr = formatDisplayDate(req.time_slot);
        const timeStr = getTimeFromSlot(req.time_slot);

        return `
            <div class="col-md-6 col-lg-4">
                <div class="req-card ${s.cls} h-100 d-flex flex-column">

                    <!-- Top: person + status -->
                    <div class="req-card-top d-flex align-items-center gap-3 mb-3">
                        <div class="req-card-avatar-wrap position-relative flex-shrink-0">
                            <div class="req-card-avatar rounded-circle overflow-hidden">
                                ${getAvatarHTML(pic, name)}
                            </div>
                        </div>
                        <div class="flex-grow-1 overflow-hidden">
                            <div class="req-card-name fw-bold text-truncate">${escapeHTML(name)}</div>
                            <div class="req-card-username text-truncate">@${escapeHTML(username || 'unknown')}</div>
                        </div>
                        <span class="req-badge ${s.badge}">
                            <i class="fas ${s.icon} me-1"></i>${s.label}
                        </span>
                    </div>

                    <!-- Middle: session info -->
                    <div class="req-card-body flex-grow-1">
                        <div class="req-card-topic text-truncate mb-2">${escapeHTML(req.topic || 'No specific topic')}</div>

                        <div class="req-card-tags d-flex flex-wrap gap-1 mb-3">
                            <span class="req-tag req-tag-module">
                                <i class="fas fa-book-open fa-xs"></i>${escapeHTML(req.module_code || 'General')}
                            </span>
                            <span class="req-tag req-tag-type">
                                <i class="fas fa-users fa-xs"></i>${sessionType}
                            </span>
                        </div>

                        <div class="req-card-details">
                            <div class="req-detail-row">
                                <i class="fas fa-calendar-alt req-detail-icon"></i>
                                <span>${escapeHTML(dateStr)}</span>
                            </div>
                            <div class="req-detail-row">
                                <i class="fas fa-clock req-detail-icon"></i>
                                <span>${escapeHTML(timeStr)}</span>
                            </div>
                            <div class="req-detail-row">
                                <i class="fas fa-map-marker-alt req-detail-icon"></i>
                                <span class="text-truncate">${escapeHTML(req.location || 'N/A')}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Bottom: actions -->
                    <div class="req-card-footer mt-3">
                        ${isReceived && req.status === 'Pending' ? `
                            <div class="d-flex gap-2 mb-2">
                                <button class="btn btn-accent flex-grow-1 py-2 rounded-4 fw-bold small" onclick="window.confirmUpdateStatus(${req.request_id}, 'Accepted')">
                                    <i class="fas fa-check fa-xs me-1"></i>Accept
                                </button>
                                <button class="btn btn-outline-danger flex-grow-1 py-2 rounded-4 fw-bold small" onclick="window.confirmUpdateStatus(${req.request_id}, 'Declined')">
                                    <i class="fas fa-times fa-xs me-1"></i>Decline
                                </button>
                            </div>
                            <button class="btn btn-white w-100 py-2 rounded-4 fw-bold small" onclick="window.viewRequestDetail(${req.request_id})">
                                View Details
                            </button>
                        ` : !isReceived && req.status === 'Pending' ? `
                            <div class="d-flex gap-2">
                                <button class="btn btn-outline-danger flex-grow-1 py-2 rounded-4 fw-bold small" onclick="window.confirmUpdateStatus(${req.request_id}, 'Cancelled')">
                                    <i class="fas fa-ban fa-xs me-1"></i>Cancel
                                </button>
                                <button class="btn btn-white flex-grow-1 py-2 rounded-4 fw-bold small" onclick="window.viewRequestDetail(${req.request_id})">
                                    Details
                                </button>
                            </div>
                        ` : req.status === 'Accepted' ? `
                            <div class="d-flex gap-2">
                                <button class="btn btn-accent flex-grow-1 py-2 rounded-4 fw-bold small" onclick="window.openChatWithStudent(${otherId})">
                                    <i class="fas fa-comments fa-xs me-1"></i>Chat
                                </button>
                                <button class="btn btn-white flex-grow-1 py-2 rounded-4 fw-bold small" onclick="window.viewRequestDetail(${req.request_id})">
                                    Details
                                </button>
                            </div>
                        ` : `
                            <button class="btn btn-white w-100 py-2 rounded-4 fw-bold small" onclick="window.viewRequestDetail(${req.request_id})">
                                View Details
                            </button>
                        `}
                    </div>
                </div>
            </div>
        `;
    }

    window.viewRequestDetail = async function(id) {
        const drawerEl = document.getElementById('requestDetailDrawer');
        const drawer = new bootstrap.Offcanvas(drawerEl);
        const content = document.getElementById('requestDetailContent');
        
        content.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-primary"></div></div>';
        drawer.show();

        try {
            const token = auth.getToken();
            const res = await fetch(`/api/matches/request/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const req = await res.json();
            
            const isReceived = req.receiver_id == auth.getUser().user_id;
            const otherName = isReceived ? (req.sender_name || 'User') : (req.receiver_name || 'User');
            const otherId = isReceived ? req.sender_id : req.receiver_id;
            const relatedStudent = getStudentById(otherId) || activeMatches.find(match => Number(match.user_id) === Number(otherId));
            const score = relatedStudent ? getMatchScore(relatedStudent) : null;
            const coParticipantNames = Array.isArray(req.co_participant_names)
                ? req.co_participant_names.map(name => escapeHTML(name)).join(', ')
                : '';
            
            const statusClass = req.status === 'Accepted' ? 'status-badge-accepted' : req.status === 'Rejected' || req.status === 'Declined' || req.status === 'Cancelled' ? 'status-badge-declined' : 'status-badge-pending';
            
            content.innerHTML = `
                <div class="mb-4 text-center position-relative">
                    <span class="badge ${statusClass} rounded-pill position-absolute top-0 end-0 px-3 py-2 fw-bold uppercase smaller">${escapeHTML(req.status || 'Pending')}</span>
                    <div class="avatar-wrap rounded-circle overflow-hidden mx-auto mb-3 border-0" style="width: 80px; height: 80px;">
                        ${isReceived ? getAvatarHTML(req.sender_pic, otherName) : getAvatarHTML(req.receiver_pic, otherName)}
                    </div>
                    <h4 class="fw-bold mb-1">${escapeHTML(otherName)}</h4>
                    <p class="text-muted mb-0 small">"${escapeHTML(req.topic || 'Study Request')}"</p>
                </div>

                <!-- Similarity Insights / Match Analysis -->
                <div class="match-analysis-card p-4 rounded-4 mb-4 position-relative overflow-hidden shadow-sm">
                    <div class="match-analysis-glow"></div>
                    <div class="position-absolute top-0 end-0 p-3 opacity-15">
                        <i class="fas fa-bolt fa-3x text-primary"></i>
                    </div>
                    <div class="d-flex justify-content-between align-items-center mb-3 position-relative z-1">
                        <h6 class="fw-bold text-primary smaller uppercase mb-0"><i class="fas fa-magic me-2"></i>Match Analysis</h6>
                        <span class="badge bg-primary rounded-pill px-2.5 py-1 fw-bold">${score === null ? 'Accepted request' : `${score}% Match`}</span>
                    </div>
                    
                    <div class="progress mb-3 position-relative z-1" style="height: 6px;">
                        <div class="progress-bar bg-primary" role="progressbar" style="width: ${score === null ? 100 : score}%;"></div>
                    </div>

                    <div class="d-flex flex-wrap gap-2 position-relative z-1">
                        <div class="small d-flex align-items-center gap-2 bg-white px-3 py-1.5 rounded-pill shadow-xs border">
                            <i class="fas fa-book text-primary smaller"></i> <span class="smaller">Module: <strong>${escapeHTML(req.module_code || 'General')}</strong></span>
                        </div>
                        <div class="small d-flex align-items-center gap-2 bg-white px-3 py-1.5 rounded-pill shadow-xs border">
                            <i class="fas fa-calendar-check text-success smaller"></i> <span class="smaller"><strong>${escapeHTML(formatDisplayDate(req.time_slot))}</strong></span>
                        </div>
                        <div class="small d-flex align-items-center gap-2 bg-white px-3 py-1.5 rounded-pill shadow-xs border">
                            <i class="fas fa-clock text-primary smaller"></i> <span class="smaller"><strong>${escapeHTML(getTimeFromSlot(req.time_slot))}</strong></span>
                        </div>
                    </div>
                </div>

                <div class="row g-4 mb-4">
                    <div class="col-6">
                        <label class="smaller text-muted fw-bold uppercase d-block">MODULE</label>
                        <span class="fw-bold">${escapeHTML(req.module_code || 'N/A')}</span>
                    </div>
                    <div class="col-6">
                        <label class="smaller text-muted fw-bold uppercase d-block">SESSION TYPE</label>
                        <span class="badge bg-light border text-dark rounded-pill fw-bold px-3"><i class="fas fa-users me-1 text-primary"></i> ${req.type === 'group' ? 'Group Study' : '1-on-1'}</span>
                    </div>
                    <div class="col-6">
                        <label class="smaller text-muted fw-bold uppercase d-block">DATE</label>
                        <span class="fw-bold"><i class="far fa-calendar-alt me-2 text-primary"></i>${escapeHTML(formatDisplayDate(req.time_slot))}</span>
                    </div>
                    <div class="col-6">
                        <label class="smaller text-muted fw-bold uppercase d-block">TIME</label>
                        <span class="fw-bold"><i class="far fa-clock me-2 text-primary"></i>${escapeHTML(getTimeFromSlot(req.time_slot))}</span>
                    </div>
                    <div class="col-12">
                        <label class="smaller text-muted fw-bold uppercase d-block">LOCATION</label>
                        <span class="fw-bold"><i class="fas fa-map-marker-alt me-2 text-primary"></i>${escapeHTML(req.location || 'N/A')}</span>
                    </div>
                    ${req.type === 'group' ? `
                    <div class="col-12">
                        <label class="smaller text-muted fw-bold uppercase d-block">CO-PARTICIPANTS</label>
                        <span class="fw-bold"><i class="fas fa-user-friends me-2 text-primary"></i>${coParticipantNames || 'No participants invited'}</span>
                    </div>
                    ` : ''}
                    <div class="col-12">
                        <label class="smaller text-muted fw-bold uppercase d-block">PERSONAL NOTE</label>
                        <div class="p-3 bg-light rounded-4 small italic">
                            "${escapeHTML(req.message || 'No note attached.')}"
                        </div>
                    </div>
                </div>

                ${isReceived && req.status === 'Pending' ? `
                    <div class="d-grid gap-2">
                        <button class="btn btn-accent py-3 rounded-4" onclick="window.confirmUpdateStatus(${req.request_id}, 'Accepted')">ACCEPT REQUEST</button>
                        <button class="btn btn-outline-danger py-3 rounded-4" onclick="window.confirmUpdateStatus(${req.request_id}, 'Declined')">DECLINE</button>
                    </div>
                ` : !isReceived && req.status === 'Pending' ? `
                    <div class="d-grid">
                        <button class="btn btn-outline-danger py-3 rounded-4" onclick="window.confirmUpdateStatus(${req.request_id}, 'Cancelled')">CANCEL REQUEST</button>
                    </div>
                ` : req.status === 'Accepted' ? `
                    <div class="d-grid gap-2">
                        <button class="btn btn-accent py-3 rounded-4" onclick="window.openChatWithStudent(${otherId})">OPEN CHAT</button>
                        ${req.event_id ? '<a class="btn btn-white py-3 rounded-4 fw-bold" href="home.html">VIEW CALENDAR</a>' : ''}
                    </div>
                ` : ''}
            `;
        } catch (err) {
            content.innerHTML = '<div class="alert alert-danger">Error loading details.</div>';
        }
    };

    window.updateRequestStatus = async function(id, status) {
        try {
            const res = await fetch(`/api/matches/request/${id}/status`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${auth.getToken()}`
                },
                body: JSON.stringify({ status })
            });
            if (res.status === 401) return auth.logout();
            if (res.ok) {
                const result = await res.json();
                // Close offcanvas if open
                const drawerEl = document.getElementById('requestDetailDrawer');
                const drawer = bootstrap.Offcanvas.getInstance(drawerEl);
                if (drawer) drawer.hide();
                
                loadRequests();
                const suffix = status === 'Accepted' && result.conversation_id
                    ? ' Chat is now available.'
                    : '';
                if (typeof showSuccess === 'function') showSuccess(`Request ${status.toLowerCase()} successfully!${suffix}`);
            } else {
                const err = await res.json();
                showThemedAlert(err.message || 'Error updating status.', {
                    title: 'Request Not Updated',
                    tone: 'danger',
                });
            }
        } catch (err) {
            showThemedAlert('Error updating status.', {
                title: 'Request Not Updated',
                tone: 'danger',
            });
        }
    };

    window.openMatchModal = async function(id, name) {
        await closeCompareModalIfOpen();
        clearMatchErrors();
        const targetStudent = getStudentById(id);
        const displayName = name || targetStudent?.name || 'this student';
        const form = document.getElementById('matchRequestForm');
        if (form) form.reset();
        document.getElementById('targetId').value = id;
        document.getElementById('targetName').innerText = displayName;
        renderScheduleSuggestions(targetStudent);
        
        // Reset and show loading state
        const moduleSelect = document.getElementById('reqModuleId');
        moduleSelect.innerHTML = '<option value="">Loading shared modules...</option>';
        
        const coPartGroup = document.getElementById('coParticipantsGroup');
        const coPartSelect = document.getElementById('reqCoParticipants');
        if (coPartGroup) coPartGroup.classList.add('d-none');
        if (coPartSelect) coPartSelect.innerHTML = '<option value="">Loading friends...</option>';
        
        const modal = new bootstrap.Modal(document.getElementById('matchModal'));
        modal.show();

        try {
            const [res, friendsRes] = await Promise.all([
                fetch(`/api/matches/shared/${id}`, { headers: { 'Authorization': `Bearer ${auth.getToken()}` } }),
                fetch(`/api/friends`, { headers: { 'Authorization': `Bearer ${auth.getToken()}` } })
            ]);
            if (res.ok) {
                const shared = await res.json();
                moduleSelect.innerHTML = '<option value="">Select a module...</option>';
                if (shared.length === 0) {
                    moduleSelect.innerHTML = '<option value="">No shared modules found</option>';
                } else {
                    shared.forEach(m => {
                        moduleSelect.innerHTML += `<option value="${m.module_id}">${escapeHTML(m.code)} - ${escapeHTML(m.name)}</option>`;
                    });
                }
            }
            if (friendsRes.ok && coPartSelect) {
                const friends = await friendsRes.json();
                coPartSelect.innerHTML = '';
                if (friends.length === 0) {
                    coPartSelect.innerHTML = '<option value="" disabled>No friends available to invite</option>';
                } else {
                    friends.forEach(f => {
                        coPartSelect.innerHTML += `<option value="${f.friend_id || f.user_id}">${escapeHTML(f.username || f.name)}</option>`;
                    });
                }
            }
        } catch (err) {
            moduleSelect.innerHTML = '<option value="">Error loading modules</option>';
            if (coPartSelect) coPartSelect.innerHTML = '<option value="">Error loading friends</option>';
        }
    };

    function clearMatchErrors() {
        document.querySelectorAll('.error-message').forEach(el => {
            el.innerText = '';
            el.style.display = 'none';
        });
        document.querySelectorAll('#matchRequestForm .form-control, #matchRequestForm .form-select').forEach(el => {
            el.classList.remove('is-invalid-field');
        });
    }

    function showMatchError(id, msg) {
        const el = document.getElementById(id);
        if (el) {
            el.innerText = msg;
            el.style.display = 'block';
            
            const map = {
                'errModule': 'reqModuleId',
                'errTopic': 'reqTopic',
                'errType': 'reqType',
                'errDate': 'reqDate',
                'errTime': 'reqTime',
                'errLocation': 'reqLocation'
            };
            
            const inputId = map[id];
            const inputEl = document.getElementById(inputId);
            if (inputEl) {
                inputEl.classList.add('is-invalid-field');
            }
        }
    }

    window.toggleReqOnline = function() {
        const isOnline = document.getElementById('reqIsOnline')?.checked || false;
        const locInput = document.getElementById('reqLocation');
        const locStar = document.getElementById('reqLocationStar');
        if (!locInput) return;
        if (isOnline) {
            locInput.value = 'Online';
            locInput.disabled = true;
            if (locStar) locStar.style.display = 'none';
        } else {
            locInput.value = '';
            locInput.disabled = false;
            if (locStar) locStar.style.display = 'inline';
        }
    };

    async function sendMatchRequest() {
        clearMatchErrors();

        const targetId = document.getElementById('targetId').value;
        const moduleId = document.getElementById('reqModuleId').value;
        const topic = document.getElementById('reqTopic').value;
        const type = document.getElementById('reqType').value;
        const date = document.getElementById('reqDate').value;
        const time = document.getElementById('reqTime').value;
        const isOnline = document.getElementById('reqIsOnline')?.checked || false;
        const location = isOnline ? 'Online' : document.getElementById('reqLocation').value;
        const note = document.getElementById('reqNote').value;
        const coPartSelect = document.getElementById('reqCoParticipants');
        const coParticipants = coPartSelect && type === 'group' ? Array.from(coPartSelect.selectedOptions).map(opt => parseInt(opt.value)) : [];

        let hasError = false;

        if (!moduleId) {
            showMatchError('errModule', "Please select a module.");
            hasError = true;
        }

        if (!topic) {
            showMatchError('errTopic', "Topic or specific goal is required.");
            hasError = true;
        }

        if (!type) {
            showMatchError('errType', "Please select a session type.");
            hasError = true;
        }

        if (!date) {
            showMatchError('errDate', "Date is required.");
            hasError = true;
        }

        if (!time) {
            showMatchError('errTime', "Time is required.");
            hasError = true;
        }

        if (!isOnline && !location) {
            showMatchError('errLocation', "Location is required.");
            hasError = true;
        }

        if (hasError) return;

        const selectedDate = new Date(`${date}T${time}`);
        const now = new Date();
        if (selectedDate < now) {
            showMatchError('errDate', "The request date and time cannot be in the past.");
            return;
        }

        const data = {
            receiver_id: parseInt(targetId),
            module_id: moduleId ? parseInt(moduleId) : null,
            topic: topic,
            time_slot: `${date} ${time}`,
            location: location,
            is_online: isOnline || location.toLowerCase().includes('online') || location.toLowerCase().includes('zoom') || location.toLowerCase().includes('teams') || location.toLowerCase().includes('meet'),
            type: type,
            co_participants: coParticipants,
            message: note
        };

        try {
            const res = await fetch('/api/matches/request', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${auth.getToken()}`
                },
                body: JSON.stringify(data)
            });
            if (res.status === 401) return auth.logout();
            if (res.ok) {
                const result = await res.json();
                const modal = bootstrap.Modal.getInstance(document.getElementById('matchModal'));
                if (modal) modal.hide();
                
                loadStudents(); 
                loadRequests();
                
                showSuccess("Match request sent successfully!");
                document.getElementById('matchRequestForm').reset();
            } else {
                const err = await res.json();
                showThemedAlert(`Error: ${err.message || res.status}`, {
                    title: 'Request Not Sent',
                    tone: 'danger',
                });
            }
        } catch (err) {
            showThemedAlert('Network error sending request.', {
                title: 'Connection Issue',
                tone: 'danger',
            });
        }
    }

    window.openProfileModal = async function(userId) {
        const student = allStudents.find(s => s.user_id == userId);
        if (!student) return;

        document.getElementById('modalName').innerText = student.name;
        document.getElementById('modalYear').innerText = `Year ${student.year || 2}`;
        document.getElementById('modalDiploma').innerText = student.diploma_name || 'Diploma in IT';
        
        const matchScore = student.match_percentage !== undefined ? student.match_percentage : (student.shared_modules_count ? Math.min(student.shared_modules_count * 25, 100) : 0);
        document.getElementById('modalMatchRate').innerText = `${matchScore}%`;
        
        document.getElementById('modalActiveHours').innerText = student.is_online ? 'Online' : 'Offline';

        const avatar = getAvatarHTML(student.profile_pic, student.name);
        document.getElementById('modalAvatarWrap').innerHTML = avatar;

        const modulesList = document.getElementById('modalModulesList');
        modulesList.innerHTML = '';
        const studentModules = (student.modules || '').split(',').filter(m => m.trim().length > 0);
        studentModules.forEach(m => {
            modulesList.innerHTML += `<span class="badge bg-indigo-subtle text-primary px-3 py-2 rounded-3 fw-bold small uppercase tracking-wider">${escapeHTML(m.trim())}</span>`;
        });

        const studentFirstWord = (student.name || 'Student').split(' ')[0];
        
        // Parse peer preferences safely
        const parsePeerJson = (val) => {
            if (!val) return [];
            if (typeof val === 'string') {
                try {
                    return JSON.parse(val);
                } catch (e) {
                    if (val.includes(',')) {
                        return val.split(',').map(s => s.trim());
                    }
                    return [val.trim()];
                }
            }
            return Array.isArray(val) ? val : [val];
        };

        const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
        const peerModes = parsePeerJson(student.selected_modes);
        const peerTimes = parsePeerJson(student.selected_times);
        const peerDays = parsePeerJson(student.availability_days);
        const peerStyles = (student.style || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
        const peerLanguages = parsePeerJson(student.selected_languages);

        let dynamicLocation = 'SP Main Campus';
        if (peerModes.includes('online') && (peerModes.includes('campus') || peerModes.includes('in-person'))) {
            dynamicLocation = 'Campus & Online';
        } else if (peerModes.includes('online')) {
            dynamicLocation = 'Online';
        } else if (peerModes.includes('campus') || peerModes.includes('in-person')) {
            dynamicLocation = 'Campus';
        }

        let dynamicPref = 'Flexible Schedule';
        if (peerTimes.length > 0 && peerStyles.length > 0) {
            dynamicPref = `${peerTimes.map(cap).join(' & ')} (${peerStyles.map(cap).join('/')})`;
        } else if (peerTimes.length > 0) {
            dynamicPref = `${peerTimes.map(cap).join(' & ')} Sessions`;
        } else if (peerStyles.length > 0) {
            dynamicPref = `${peerStyles.map(cap).join(' / ')} Study`;
        }

        let dynamicGoals;
        if (studentModules.length >= 2) {
            dynamicGoals = `"Aiming to excel in ${studentModules[0].trim()} while strengthening skills in ${studentModules[1].trim()} through collaborative study."`;
        } else if (studentModules.length === 1) {
            dynamicGoals = `"Focused on mastering ${studentModules[0].trim()} concepts and preparing for upcoming assessments."`;
        } else {
            dynamicGoals = `"Seeking a reliable study partner to tackle coursework and build academic consistency."`;
        }

        let dynamicAbout;
        if (student.profile_text && student.profile_text.trim().length > 0) {
            dynamicAbout = `"${student.profile_text.trim()}"`;
        } else {
            const langStr = peerLanguages.length > 0 ? peerLanguages.join(' & ') : 'English';
            const styleStr = peerStyles.length > 0 ? peerStyles.map(cap).join('/').toLowerCase() : 'collaborative';
            const modeStr = peerModes.length > 0 ? peerModes.map(cap).join('/').toLowerCase() : 'flexible';
            dynamicAbout = `"A motivated ${student.diploma_code || 'IT'} student who thrives in ${styleStr} study environments. Prefers ${modeStr} sessions and communicates in ${langStr}."`;
        }

        document.getElementById('modalLocation').innerText = dynamicLocation;
        document.getElementById('modalTimePreference').innerText = dynamicPref;
        document.getElementById('modalCampus').innerText = student.institution_name || 'Institution not set';
        document.getElementById('modalGoals').innerText = dynamicGoals;
        document.getElementById('modalAbout').innerText = dynamicAbout;

        const myModuleCodes = Array.isArray(masterModules) ? masterModules.map(m => m.code.trim().toUpperCase()) : [];
        const peerModuleCodes = (student.modules || '').split(',').map(m => m.trim().toUpperCase()).filter(Boolean);
        const sharedModules = peerModuleCodes.filter(code => myModuleCodes.includes(code));

        const myDays = Array.isArray(userPreferences.availability_days) ? userPreferences.availability_days : [];
        const sharedDays = myDays.filter(d => peerDays.includes(d));
        const myStyles = (userPreferences.style || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
        const sharedStyles = myStyles.filter(s => peerStyles.includes(s));
        const myTimes = Array.isArray(userPreferences.selected_times) ? userPreferences.selected_times : [];
        const sharedTimes = myTimes.filter(t => peerTimes.includes(t));
        const myModes = Array.isArray(userPreferences.selected_modes) ? userPreferences.selected_modes : [];
        const sharedModes = myModes.filter(m => peerModes.includes(m));
        const myLanguages = Array.isArray(userPreferences.selected_languages) ? userPreferences.selected_languages.map(l => l.toLowerCase()) : [];
        const peerLangsLower = peerLanguages.map(l => l.toLowerCase());
        const sharedLanguages = myLanguages.filter(l => peerLangsLower.includes(l));
        const compatibilityItems = [];

        // Modules Compatibility
        if (sharedModules.length > 0) {
            compatibilityItems.push({
                icon: 'fa-book-open',
                color: 'text-accent-indigo',
                text: `Shared Module${sharedModules.length > 1 ? 's' : ''}: ${sharedModules.join(', ')}`
            });
        } else if (peerModuleCodes.length > 0) {
            compatibilityItems.push({
                icon: 'fa-book',
                color: 'text-muted',
                text: `Studies ${peerModuleCodes.slice(0, 2).join(', ')}`
            });
        }

        // Days Compatibility
        if (sharedDays.length > 0) {
            compatibilityItems.push({
                icon: 'fa-calendar-check',
                color: 'text-success',
                text: `Common Days: ${sharedDays.map(cap).join(', ')}`
            });
        } else if (peerDays.length > 0) {
            compatibilityItems.push({
                icon: 'fa-calendar',
                color: 'text-muted',
                text: `Available: ${peerDays.map(cap).join(', ')}`
            });
        }

        // Times Compatibility
        if (sharedTimes.length > 0) {
            compatibilityItems.push({
                icon: 'fa-clock',
                color: 'text-warning',
                text: `Overlapping Hours: ${sharedTimes.map(cap).join(' / ')}`
            });
        } else if (peerTimes.length > 0) {
            compatibilityItems.push({
                icon: 'fa-clock',
                color: 'text-muted',
                text: `Prefers ${peerTimes.map(cap).join(' / ')} sessions`
            });
        }

        // Modes Compatibility
        if (sharedModes.length > 0) {
            compatibilityItems.push({
                icon: 'fa-house-laptop',
                color: 'text-danger',
                text: `Matching Mode: ${sharedModes.map(cap).join(' / ')}`
            });
        } else if (peerModes.length > 0) {
            compatibilityItems.push({
                icon: 'fa-laptop',
                color: 'text-muted',
                text: `Prefers ${peerModes.map(cap).join(' / ')} sessions`
            });
        }

        // Study Style Compatibility
        if (sharedStyles.length > 0) {
            compatibilityItems.push({
                icon: 'fa-brain',
                color: 'text-secondary',
                text: `Shared Style: ${sharedStyles.map(cap).join(' / ')}`
            });
        } else if (peerStyles.length > 0) {
            compatibilityItems.push({
                icon: 'fa-graduation-cap',
                color: 'text-muted',
                text: `Style: ${peerStyles.map(cap).join(' / ')}`
            });
        }

        // Language Compatibility
        if (sharedLanguages.length > 0) {
            compatibilityItems.push({
                icon: 'fa-language',
                color: 'text-info',
                text: `Common Language${sharedLanguages.length > 1 ? 's' : ''}: ${sharedLanguages.map(cap).join(', ')}`
            });
        } else if (peerLanguages.length > 0) {
            compatibilityItems.push({
                icon: 'fa-language',
                color: 'text-muted',
                text: `Speaks ${peerLanguages.join(', ')}`
            });
        }

        // Course Alignment
        const localUser = auth.getUser();
        if (student.diploma_name) {
            const isSameDiploma = student.diploma_id && localUser && localUser.diploma_id === student.diploma_id;
            compatibilityItems.push({
                icon: 'fa-award',
                color: isSameDiploma ? 'text-success' : 'text-muted',
                text: isSameDiploma ? `Same Course: ${student.diploma_code || 'IT'}` : `${student.diploma_code || 'IT'} Student`
            });
        }

        // Show up to 4 most relevant compatibility badges
        const finalItems = compatibilityItems.slice(0, 4);
        const compatList = document.getElementById('modalCompatibilityList');
        compatList.innerHTML = finalItems.map(item => `
            <div class="col-md-6 d-flex align-items-center gap-2 mb-2">
                <i class="fas ${item.icon} ${item.color || 'text-success'}"></i>
                <span class="small fw-bold">${escapeHTML(item.text)}</span>
            </div>
        `).join('');

        const insightParts = [];

        if (sharedModules.length > 1) {
            insightParts.push(`You and ${studentFirstWord} share ${sharedModules.join(', ')}, giving this match strong module overlap.`);
        } else if (sharedModules.length === 1) {
            insightParts.push(`You and ${studentFirstWord} both study ${sharedModules[0]}, so the request can stay focused and practical.`);
        } else if (peerModuleCodes.length > 0) {
            insightParts.push(`${studentFirstWord} is studying ${peerModuleCodes.slice(0, 2).join(', ')}, which may still support cross-module study.`);
        } else {
            insightParts.push(`${studentFirstWord} has limited module data, so check their profile before sending a request.`);
        }

        if (sharedDays.length > 0 && sharedTimes.length > 0) {
            insightParts.push(`Your saved availability overlaps on ${sharedDays.map(cap).join(', ')} during ${sharedTimes.map(cap).join(' / ')} sessions.`);
        } else if (sharedDays.length > 0) {
            insightParts.push(`You share available days: ${sharedDays.map(cap).join(', ')}.`);
        } else if (sharedModes.length > 0) {
            insightParts.push(`Both of you support ${sharedModes.map(cap).join(' / ')} sessions.`);
        } else if (sharedStyles.length > 0) {
            insightParts.push(`Your study style overlap is ${sharedStyles.map(cap).join(' / ')}.`);
        } else if (sharedLanguages.length > 0) {
            insightParts.push(`You share ${sharedLanguages.map(cap).join(', ')} as a preferred language.`);
        }

        document.getElementById('modalAiInsight').innerText = insightParts.join(' ');

        const scoreBreakdown = document.getElementById('modalScoreBreakdown');
        const scoreBreakdownTotal = document.getElementById('modalScoreBreakdownTotal');
        if (scoreBreakdown) {
            scoreBreakdown.innerHTML = getScoreBreakdownHTML(student) || `
                <div class="score-breakdown-empty">No match score details available for this profile.</div>
            `;
        }
        if (scoreBreakdownTotal) {
            scoreBreakdownTotal.innerText = `${getMatchScore(student)} / 100`;
        }

        const viewFullProfileBtn = document.getElementById('modalViewFullProfile');
        if (viewFullProfileBtn) {
            viewFullProfileBtn.href = `viewProfile.html?friendId=${student.user_id}`;
        }

        updateModalSaveButton(student.user_id);
        const hideBtn = document.getElementById('modalHideBtn');
        if (hideBtn) {
            hideBtn.onclick = function() {
                window.hideMatchStudent(student.user_id);
            };
        }
        const reportBtn = document.getElementById('modalReportBtn');
        if (reportBtn) {
            reportBtn.onclick = function() {
                window.openReportStudentDialog(student.user_id);
            };
        }
        const blockBtn = document.getElementById('modalBlockBtn');
        if (blockBtn) {
            blockBtn.onclick = function() {
                window.blockMatchStudent(student.user_id);
            };
        }

        const connectBtn = document.getElementById('modalConnectBtn');
        if (student.request_status === 'Pending') {
            connectBtn.className = 'btn btn-secondary flex-grow-1 py-3 rounded-4 fw-bold uppercase small';
            connectBtn.innerHTML = `<i class="fas fa-check-circle me-2"></i>Request Sent`;
            connectBtn.disabled = true;
        } else if (student.request_status === 'Accepted') {
            connectBtn.className = 'btn btn-success flex-grow-1 py-3 rounded-4 fw-bold uppercase small';
            connectBtn.innerHTML = `<i class="fas fa-comments me-2"></i>Message`;
            connectBtn.disabled = false;
            connectBtn.onclick = function() {
                window.openChatWithStudent(student.user_id);
            };
        } else {
            connectBtn.className =
                'btn btn-accent flex-grow-1 py-3 rounded-4 fw-bold uppercase small shadow-soft';
            connectBtn.innerHTML = `<i class="fas fa-paper-plane me-2"></i>Send Request`;
            connectBtn.disabled = false;
            connectBtn.onclick = function() {
                const profModalEl = document.getElementById('studentProfileModal');
                const profModal = bootstrap.Modal.getInstance(profModalEl);
                if (profModal) profModal.hide();
                window.openMatchModal(student.user_id);
            };
        }

        const profileModalEl = document.getElementById('studentProfileModal');
        const modal = new bootstrap.Modal(profileModalEl);
        modal.show();
    };

    init();
});
