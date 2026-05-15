document.addEventListener("DOMContentLoaded", function () {
    if (typeof auth === 'undefined' || !auth.isLoggedIn()) { 
        window.location.href = 'login.html'; 
        return;
    }

    let allStudents = [];
    let masterModules = []; 
    let availableLanguages = [];
    let userPreferences = {
        selected_modules: [],
        availability_days: [],
        selected_modes: [],
        selected_times: [],
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
                            <span class="fw-black text-dark">${m.code}</span>
                            <span class="text-muted small ms-2">${m.name}</span>
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

    function showConfirm(msg, callback) {
        const msgEl = document.getElementById('confirmModalMessage');
        if (msgEl) msgEl.innerText = msg;
        const btn = document.getElementById('confirmModalBtn');
        const modalEl = document.getElementById('confirmModal');
        const modal = new bootstrap.Modal(modalEl);
        
        btn.onclick = () => {
            modal.hide();
            modalEl.addEventListener('hidden.bs.modal', () => callback(), { once: true });
        };
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
                <div class="form-check ps-2">
                    <input class="form-check-input d-none" type="checkbox" value="${mid}" id="filterMod${mid}" onchange="filterStudents()">
                    <label class="btn btn-outline-primary btn-sm rounded-pill px-2 py-1 smaller fw-bold" for="filterMod${mid}">
                        ${code}
                    </label>
                </div>
            `;
        });
    }

    async function loadModules() {
        try {
            const res = await fetch('/api/modules', {
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
                        select.innerHTML += `<option value="${l.name}">${l.name.toUpperCase()}</option>`;
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
                selected_modes: Array.from(form.querySelectorAll('[id^="mode"]:checked')).map(el => el.value),
                selected_times: Array.from(form.querySelectorAll('[id^="time"]:checked')).map(el => el.value),
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
                alert("Save Error: " + (errData.error || res.status));
            }
        } catch (err) { alert("Network error saving preferences"); }
    }

    async function loadStudents() {
        try {
            const res = await fetch('/api/matches/auto', {
                headers: { 'Authorization': `Bearer ${auth.getToken()}` }
            });
            if (res.status === 401) return auth.logout();
            if (res.ok) {
                const data = await res.json();
                allStudents = data.matches || [];
            }
            window.filterStudents();
        } catch (err) { 
            allStudents = [];
            window.filterStudents();
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
                        ${code}
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
            ['day', 'mode', 'time', 'style'].forEach(prefix => {
                let list = [];
                if (prefix === 'day') list = userPreferences.availability_days;
                else if (prefix === 'mode') list = userPreferences.selected_modes;
                else if (prefix === 'time') list = userPreferences.selected_times;
                else if (prefix === 'style') list = (userPreferences.style || '').split(',');
                document.querySelectorAll(`[id^="${prefix}"]`).forEach(el => {
                    if (el.type === 'checkbox') el.checked = list.includes(el.value);
                });
            });
        }
        toggleAutoMatchVisibility();
    }

    window.filterStudents = function() {
        const searchInput = document.getElementById('searchInput');
        if (!searchInput) return;
        const search = searchInput.value.toLowerCase();
        const onlineOnly = document.getElementById('onlineFilter')?.checked || false;
        const sortBy = document.getElementById('sortSelect')?.value || 'match';
        const selectedModuleIds = Array.from(document.querySelectorAll('#filterModules input:checked')).map(el => el.value);

        let filtered = allStudents.filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(search);
            const matchesOnline = !onlineOnly || s.is_online;
            const studentModules = (s.modules || '').split(',').map(m => m.trim());
            const matchesModules = selectedModuleIds.length === 0 || selectedModuleIds.some(mid => {
                const m = masterModules.find(um => um.module_id == mid);
                return m && studentModules.includes(m.code);
            });

            return matchesSearch && matchesOnline && matchesModules;
        });

        if (sortBy === 'match') {
            filtered.sort((a, b) => (b.shared_modules_count || 0) - (a.shared_modules_count || 0));
        } else if (sortBy === 'name') {
            filtered.sort((a, b) => a.name.localeCompare(b.name));
        }
        renderStudents(filtered);
    };

    function renderStudents(students) {
        const grid = document.getElementById('studentGrid');
        if (!grid) return;
        grid.innerHTML = '';
        if (students.length === 0) {
            grid.innerHTML = '<div class="col-12 text-center py-5"><p class="text-muted">No matches found. Try adjusting your preferences.</p></div>';
            return;
        }
        students.forEach(s => {
            const matchScore = s.shared_modules_count ? Math.min(s.shared_modules_count * 25, 100) : 0;
            grid.innerHTML += `
                <div class="col-md-6 col-xl-4">
                    <div class="student-card h-100">
                        <div class="d-flex align-items-start justify-content-between mb-3">
                            <div class="avatar-wrap">
                                ${s.profile_pic ? `<img src="${s.profile_pic}" class="rounded-2" width="60">` : `<i class="fas fa-user text-muted"></i>`}
                                ${s.is_online ? '<span class="online-dot"></span>' : ''}
                            </div>
                            <div class="match-score">${matchScore}% Match</div>
                        </div>
                        <h5 class="fw-black mb-1">${s.name}</h5>
                        <p class="text-muted small mb-3">@${s.username}</p>
                        ${s.request_status === 'Pending' ? 
                            `<button class="btn btn-secondary w-100 py-2 rounded-4 fw-bold text-white" disabled>REQUEST SENT</button>` :
                          s.request_status === 'Accepted' ?
                            `<button class="btn btn-success w-100 py-2 rounded-4 fw-bold" disabled>MATCHED</button>` :
                            `<button class="btn btn-primary w-100 py-2 rounded-4 fw-bold" onclick="window.openMatchModal(${s.user_id}, '${s.name}')">CONNECT</button>`
                        }
                    </div>
                </div>
            `;
        });
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
        const datePart = dateStr.split(' ')[0];
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
                        <h4 class="fw-black mb-3">${title}</h4>
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
        
        let statusClass = 'bg-warning text-dark';
        if (req.status === 'Accepted') statusClass = 'bg-success text-white';
        if (req.status === 'Rejected' || req.status === 'Declined' || req.status === 'Cancelled') statusClass = 'bg-danger text-white';

        return `
            <div class="col-md-6 col-lg-4">
                <div class="card border-0 shadow-sm rounded-4 h-100 p-3">
                    <div class="card-body p-3 d-flex flex-column">
                        <div class="d-flex align-items-center mb-3">
                            <div class="avatar-wrap me-3 mb-0" style="width: 40px; height: 40px; flex-shrink: 0;">
                                ${pic ? `<img src="${pic}" class="rounded-circle" width="40" height="40">` : `<div class="bg-light rounded-circle d-flex align-items-center justify-content-center" style="width:40px;height:40px;"><i class="fas fa-user text-muted"></i></div>`}
                            </div>
                            <div class="overflow-hidden flex-grow-1">
                                <h6 class="fw-black mb-0 text-truncate">${name}</h6>
                                <p class="text-muted smaller mb-0">@${username || 'unknown'}</p>
                            </div>
                            <span class="badge ${statusClass} rounded-pill smaller uppercase fw-bold ms-2">${req.status}</span>
                        </div>

                        <div class="mb-3 flex-grow-1">
                            <div class="mb-2">
                                <span class="badge bg-light text-dark border rounded-pill smaller fw-bold"><i class="fas fa-book text-primary me-1"></i> ${req.module_code || 'General'}</span>
                                <span class="badge bg-light text-dark border rounded-pill smaller fw-bold"><i class="fas fa-users text-primary me-1"></i> ${req.type === 'group' ? 'Group Study' : '1-on-1'}</span>
                            </div>
                            <p class="mb-2 small text-truncate fw-bold">${req.topic || 'No specific topic'}</p>
                            
                            <div class="d-flex align-items-center gap-3 mb-1">
                                <div class="smaller text-muted d-flex align-items-center"><i class="far fa-calendar-alt text-primary me-2"></i> ${formatDisplayDate(req.time_slot)}</div>
                                <div class="smaller text-muted d-flex align-items-center"><i class="far fa-clock text-primary me-2"></i> ${req.time_slot ? req.time_slot.split(' ')[1] : 'N/A'}</div>
                            </div>
                            <div class="smaller text-muted d-flex align-items-center text-truncate"><i class="fas fa-map-marker-alt text-primary me-2"></i> ${req.location || 'N/A'}</div>
                        </div>
                        
                        <div class="mt-auto pt-3 border-top">
                            ${isReceived && req.status === 'Pending' ? `
                                <div class="d-flex gap-2 mb-2">
                                    <button class="btn btn-primary btn-sm flex-grow-1 rounded-pill fw-bold py-2" onclick="window.confirmUpdateStatus(${req.request_id}, 'Accepted')">ACCEPT</button>
                                    <button class="btn btn-outline-danger btn-sm flex-grow-1 rounded-pill fw-bold py-2" onclick="window.confirmUpdateStatus(${req.request_id}, 'Declined')">DECLINE</button>
                                </div>
                                <button class="btn btn-light btn-sm w-100 rounded-pill fw-bold py-2 text-primary border" onclick="window.viewRequestDetail(${req.request_id})">VIEW DETAILS</button>
                            ` : !isReceived && req.status === 'Pending' ? `
                                <div class="d-flex gap-2">
                                    <button class="btn btn-outline-danger btn-sm flex-grow-1 rounded-pill fw-bold py-2" onclick="window.confirmUpdateStatus(${req.request_id}, 'Cancelled')">CANCEL</button>
                                    <button class="btn btn-outline-primary btn-sm flex-grow-1 rounded-pill fw-bold py-2" onclick="window.viewRequestDetail(${req.request_id})">DETAILS</button>
                                </div>
                            ` : `
                                <button class="btn btn-outline-primary btn-sm w-100 rounded-pill fw-bold py-2" onclick="window.viewRequestDetail(${req.request_id})">VIEW DETAILS</button>
                            `}
                        </div>
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
            
            content.innerHTML = `
                <div class="mb-4 text-center position-relative">
                    <span class="badge ${req.status === 'Accepted' ? 'bg-success' : req.status === 'Rejected' || req.status === 'Declined' || req.status === 'Cancelled' ? 'bg-danger' : 'bg-warning text-dark'} rounded-pill position-absolute top-0 end-0">${req.status}</span>
                    <div class="avatar-wrap mx-auto mb-3" style="width: 80px; height: 80px;">
                        ${isReceived ? (req.sender_pic ? `<img src="${req.sender_pic}" class="rounded-circle w-100 h-100">` : `<i class="fas fa-user-circle text-muted" style="font-size: 80px;"></i>`) : (req.receiver_pic ? `<img src="${req.receiver_pic}" class="rounded-circle w-100 h-100">` : `<i class="fas fa-user-circle text-muted" style="font-size: 80px;"></i>`)}
                    </div>
                    <h4 class="fw-black mb-1">${otherName}</h4>
                    <p class="text-muted mb-0 small">"${req.topic || 'Study Request'}"</p>
                </div>

                ${isReceived ? `
                <!-- Similarity Insights -->
                <div class="p-4 bg-primary bg-opacity-10 rounded-4 mb-4 position-relative overflow-hidden">
                    <div class="position-absolute top-0 end-0 p-3 opacity-25">
                        <i class="fas fa-bolt fa-4x text-primary"></i>
                    </div>
                    <div class="d-flex justify-content-between align-items-center mb-3 position-relative z-1">
                        <h6 class="fw-black text-primary smaller uppercase mb-0"><i class="fas fa-magic me-2"></i>Match Analysis</h6>
                        <span class="badge bg-primary rounded-pill">85% Match</span>
                    </div>
                    
                    <div class="progress mb-3 position-relative z-1" style="height: 6px;">
                        <div class="progress-bar bg-primary" role="progressbar" style="width: 85%;"></div>
                    </div>

                    <div class="d-flex flex-wrap gap-2 position-relative z-1">
                        <div class="small d-flex align-items-center gap-2 bg-white px-3 py-2 rounded-pill shadow-sm">
                            <i class="fas fa-book text-primary"></i> <span>Shared Module: <strong>${req.module_code || 'General'}</strong></span>
                        </div>
                        <div class="small d-flex align-items-center gap-2 bg-white px-3 py-2 rounded-pill shadow-sm">
                            <i class="fas fa-check-circle text-success"></i> <span>Matched on <strong>Schedule</strong></span>
                        </div>
                        <div class="small d-flex align-items-center gap-2 bg-white px-3 py-2 rounded-pill shadow-sm">
                            <i class="fas fa-layer-group text-primary"></i> <span>Similar <strong>Level</strong></span>
                        </div>
                    </div>
                </div>
                ` : ''}

                <div class="row g-4 mb-4">
                    <div class="col-6">
                        <label class="smaller text-muted fw-bold uppercase d-block">MODULE</label>
                        <span class="fw-bold">${req.module_code || 'N/A'}</span>
                    </div>
                    <div class="col-6">
                        <label class="smaller text-muted fw-bold uppercase d-block">SESSION TYPE</label>
                        <span class="badge bg-light border text-dark rounded-pill fw-bold px-3"><i class="fas fa-users me-1 text-primary"></i> ${req.type === 'group' ? 'Group Study' : '1-on-1'}</span>
                    </div>
                    <div class="col-6">
                        <label class="smaller text-muted fw-bold uppercase d-block">DATE</label>
                        <span class="fw-bold"><i class="far fa-calendar-alt me-2 text-primary"></i>${formatDisplayDate(req.time_slot)}</span>
                    </div>
                    <div class="col-6">
                        <label class="smaller text-muted fw-bold uppercase d-block">TIME</label>
                        <span class="fw-bold"><i class="far fa-clock me-2 text-primary"></i>${req.time_slot ? req.time_slot.split(' ')[1] : 'N/A'}</span>
                    </div>
                    <div class="col-12">
                        <label class="smaller text-muted fw-bold uppercase d-block">LOCATION</label>
                        <span class="fw-bold"><i class="fas fa-map-marker-alt me-2 text-primary"></i>${req.location}</span>
                    </div>
                    <div class="col-12">
                        <label class="smaller text-muted fw-bold uppercase d-block">PERSONAL NOTE</label>
                        <div class="p-3 bg-light rounded-4 small italic">
                            "${req.message || 'No note attached.'}"
                        </div>
                    </div>
                </div>

                ${isReceived && req.status === 'Pending' ? `
                    <div class="d-grid gap-2">
                        <button class="btn btn-premium py-3 rounded-4" onclick="window.updateRequestStatus(${req.request_id}, 'Accepted')">ACCEPT REQUEST</button>
                        <button class="btn btn-outline-danger py-3 rounded-4" onclick="window.confirmUpdateStatus(${req.request_id}, 'Declined')">DECLINE</button>
                    </div>
                ` : !isReceived && req.status === 'Pending' ? `
                    <div class="d-grid">
                        <button class="btn btn-outline-danger py-3 rounded-4" onclick="window.confirmUpdateStatus(${req.request_id}, 'Cancelled')">CANCEL REQUEST</button>
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
                // Close offcanvas if open
                const drawerEl = document.getElementById('requestDetailDrawer');
                const drawer = bootstrap.Offcanvas.getInstance(drawerEl);
                if (drawer) drawer.hide();
                
                loadRequests();
                if (typeof showSuccess === 'function') showSuccess(`Request ${status.toLowerCase()} successfully!`);
            }
        } catch (err) { alert("Error updating status"); }
    };

    window.openMatchModal = async function(id, name) {
        clearMatchErrors();
        document.getElementById('targetId').value = id;
        document.getElementById('targetName').innerText = name;
        
        // Reset and show loading state
        const moduleSelect = document.getElementById('reqModuleId');
        moduleSelect.innerHTML = '<option value="">Loading shared modules...</option>';
        
        const modal = new bootstrap.Modal(document.getElementById('matchModal'));
        modal.show();

        try {
            const res = await fetch(`/api/matches/shared/${id}`, {
                headers: { 'Authorization': `Bearer ${auth.getToken()}` }
            });
            if (res.ok) {
                const shared = await res.json();
                moduleSelect.innerHTML = '<option value="">Select a module...</option>';
                if (shared.length === 0) {
                    moduleSelect.innerHTML = '<option value="">No shared modules found</option>';
                } else {
                    shared.forEach(m => {
                        moduleSelect.innerHTML += `<option value="${m.module_id}">${m.code} - ${m.name}</option>`;
                    });
                }
            }
        } catch (err) {
            moduleSelect.innerHTML = '<option value="">Error loading modules</option>';
        }
    };

    window.updateStatus = async function(id, status) {
        try {
            const res = await fetch(`/api/matches/requests/${id}/status`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${auth.getToken()}`
                },
                body: JSON.stringify({ status })
            });
            if (res.status === 401) return auth.logout();
            if (res.ok) {
                loadRequests();
                showSuccess(`Request ${status.toLowerCase()} successfully!`);
            }
        } catch (err) { alert("Error updating status"); }
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

    async function sendMatchRequest() {
        clearMatchErrors();

        const targetId = document.getElementById('targetId').value;
        const moduleId = document.getElementById('reqModuleId').value;
        const topic = document.getElementById('reqTopic').value;
        const type = document.getElementById('reqType').value;
        const date = document.getElementById('reqDate').value;
        const time = document.getElementById('reqTime').value;
        const location = document.getElementById('reqLocation').value;
        const note = document.getElementById('reqNote').value;

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

        if (!location) {
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
            type: type,
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
                alert("Error: " + (err.message || res.status));
            }
        } catch (err) {
            alert("Network error sending request");
        }
    }

    init();
});
