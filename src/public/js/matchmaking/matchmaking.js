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
        const browse = document.getElementById('browseSection');
        const requests = document.getElementById('requestsSection');
        if (browse) browse.style.display = tab === 'browse' ? 'block' : 'none';
        if (requests) requests.style.display = tab === 'requests' ? 'block' : 'none';
        document.querySelectorAll('.premium-tab-nav .nav-link').forEach(btn => {
            btn.classList.toggle('active', btn.innerText.toLowerCase().includes(tab));
        });
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
        showConfirm("Are you sure you want to reset all preferences? This cannot be undone.", () => {
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
            renderPreferences();
            showSuccess("All preferences have been reset to defaults.");
        });
    };

    function showSuccess(msg) {
        const msgEl = document.getElementById('successModalMessage');
        if (msgEl) msgEl.innerText = msg;
        const modal = new bootstrap.Modal(document.getElementById('successModal'));
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
            callback();
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
        } catch (err) {
            console.error("Init Error:", err);
        }
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

    async function savePreferences() {
        const form = document.getElementById('preferencesForm');
        const langSelect = document.getElementById('prefLanguages');
        if (!form) return;

        const selectedLangs = langSelect ? Array.from(langSelect.selectedOptions).map(opt => opt.value) : userPreferences.selected_languages;
        const genderVal = form.querySelector('input[name="genderPref"]:checked')?.value || userPreferences.gender_pref;
        const learningVal = form.querySelector('input[name="learningMode"]:checked')?.value || userPreferences.partner_level;

        const data = {
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
                window.filterStudents();
                showSuccess("Your match preferences have been updated successfully.");
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
                if (m) {
                    moduleContainer.innerHTML += `
                        <span class="badge bg-primary-subtle text-primary p-2 rounded-3 border border-primary border-opacity-10 d-flex align-items-center gap-2">
                            ${m.code}
                            <i class="fas fa-times-circle cursor-pointer" onclick="window.removePrefModule(${mid})"></i>
                        </span>
                    `;
                }
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

        let filtered = allStudents.filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(search);
            const matchesOnline = !onlineOnly || s.is_online;
            return matchesSearch && matchesOnline;
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
            });
        }
    }

    async function loadRequests() {
        try {
            const [sentRes, receivedRes] = await Promise.all([
                fetch('/api/matches/requests/sent', { headers: { 'Authorization': `Bearer ${auth.getToken()}` } }),
                fetch('/api/matches/requests/received', { headers: { 'Authorization': `Bearer ${auth.getToken()}` } })
            ]);
            if (sentRes.status === 401) return auth.logout();
            const sent = await sentRes.json();
            const received = await receivedRes.json();
            renderRequests('received', Array.isArray(received) ? received : []);
            renderRequests('sent', Array.isArray(sent) ? sent : []);
        } catch (err) {}
    }

    function renderRequests(type, requests) {
        const container = document.getElementById(type === 'received' ? 'receivedRequests' : 'sentRequests');
        const countEl = document.getElementById(type === 'received' ? 'receivedCount' : 'sentCount');
        if (!container || !countEl) return;
        countEl.innerText = requests.length;
        container.innerHTML = '';
        if (requests.length === 0) {
            container.innerHTML = `<p class="text-muted small">No ${type} requests found.</p>`;
            return;
        }
        requests.forEach(r => {
            const partnerName = type === 'received' 
                ? (r.sender_name || r.name || 'Unknown User') 
                : (r.receiver_name || r.name || 'Unknown User');
            const moduleInfo = r.module_code || r.module || 'Study Session';
            
            container.innerHTML += `
                <div class="card border-0 bg-light rounded-4 p-4 mb-3">
                    <h6 class="fw-black mb-0">${partnerName}</h6>
                    <p class="text-muted smaller mb-0">${moduleInfo}</p>
                    <p class="text-primary smaller fw-bold mb-0 mt-1 uppercase tracking-widest">${r.status.toUpperCase()}</p>
                    ${type === 'received' && r.status === 'Pending' ? `
                        <div class="d-flex gap-2 mt-3">
                            <button class="btn btn-primary small py-2 fw-bold" onclick="window.updateStatus(${r.request_id}, 'Accepted')">ACCEPT</button>
                            <button class="btn btn-outline-danger small py-2 fw-bold" onclick="window.updateStatus(${r.request_id}, 'Declined')">DECLINE</button>
                        </div>
                    ` : ''}
                </div>
            `;
        });
    }

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
                const modalEl = document.getElementById('matchModal');
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();
                document.getElementById('matchRequestForm').reset();
                showSuccess("Your match request has been sent successfully!");
                loadRequests();
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
