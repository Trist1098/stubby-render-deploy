document.addEventListener("DOMContentLoaded", function () {
    // Check if user is logged in
    if (!auth.isLoggedIn()) {
        window.location.href = 'login.html';
        return;
    }

    // DOM refs
    const step1       = document.getElementById('step1');
    const step2       = document.getElementById('step2');
    const instSelect  = document.getElementById('institutionId');
    const dipSelect   = document.getElementById('diplomaId');
    const yearSelect  = document.getElementById('year');
    const moduleList  = document.getElementById('moduleList');

    // Progress indicator elements (new design)
    const circle1 = document.getElementById('circle1');
    const circle2 = document.getElementById('circle2');
    const label1  = document.getElementById('label1');
    const label2  = document.getElementById('label2');
    const line1   = document.getElementById('line1');
    const obTitle = document.getElementById('obTitle');
    const obSub   = document.getElementById('obSubtitle');

    let selectedModules = new Set();

    // ── Helpers ───────────────────────────────────────────────
    const showError = (id, msg) => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = msg;
            el.style.display = 'block';
        }
    };

    const clearErrors = () => {
        document.querySelectorAll('.error-message').forEach(el => el.style.display = 'none');
    };

    const handleSelectColor = (selectEl) => {
        if (selectEl.value === "") {
            selectEl.classList.add('text-muted');
            selectEl.classList.remove('text-dark');
        } else {
            selectEl.classList.remove('text-muted');
            selectEl.classList.add('text-dark');
        }
    };

    [instSelect, dipSelect, yearSelect].forEach(el => {
        if (el) el.addEventListener('change', () => { handleSelectColor(el); clearErrors(); });
    });

    // ── Progress UI ───────────────────────────────────────────
    const goToStep2 = () => {
        if (circle1) {
            circle1.classList.remove('active');
            circle1.classList.add('done');
            circle1.innerHTML = '<i class="fas fa-check" style="font-size:0.65rem"></i>';
        }
        if (label1) { label1.classList.remove('active'); label1.classList.add('done'); }
        if (line1)  { line1.classList.add('done'); }
        if (circle2) { circle2.classList.add('active'); }
        if (label2)  { label2.classList.add('active'); }
        if (obTitle) { obTitle.textContent = 'Module Selection'; }
        if (obSub)   { obSub.textContent = 'Select all modules currently being studied.'; }
    };

    const goToStep1 = () => {
        if (circle1) {
            circle1.classList.add('active');
            circle1.classList.remove('done');
            circle1.innerHTML = '1';
        }
        if (label1) { label1.classList.add('active'); label1.classList.remove('done'); }
        if (line1)  { line1.classList.remove('done'); }
        if (circle2) { circle2.classList.remove('active'); }
        if (label2)  { label2.classList.remove('active'); }
        if (obTitle) { obTitle.textContent = 'Academic Details'; }
        if (obSub)   { obSub.textContent = 'Tell Stubby about the current academic situation.'; }
    };

    // ── Load academic data ────────────────────────────────────
    const loadAcademicData = async () => {
        try {
            const [insts, dips] = await Promise.all([
                apiRequest('/api/institution'),
                apiRequest('/api/diploma')
            ]);

            insts.forEach(i => {
                const opt = document.createElement('option');
                opt.value = i.institution_id;
                opt.textContent = i.name;
                instSelect.appendChild(opt);
            });

            dips.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d.diploma_id;
                opt.textContent = d.name;
                dipSelect.appendChild(opt);
            });

            dipSelect.disabled = false;
        } catch (err) {
            console.error('Failed to load onboarding data', err);
        }
    };

    loadAcademicData();

    // ── Step 1 → Step 2 ───────────────────────────────────────
    document.getElementById('btnNext1').addEventListener('click', async () => {
        clearErrors();
        let hasError = false;

        if (!instSelect.value) {
            showError('errInstitution', 'Please select your institution.');
            hasError = true;
        }
        if (!dipSelect.value) {
            showError('errDiploma', 'Please select your diploma.');
            hasError = true;
        }
        if (hasError) return;

        step1.classList.add('d-none');
        step2.classList.remove('d-none');
        goToStep2();

        loadModules(dipSelect.value);
    });

    // ── Step 2 → Step 1 ───────────────────────────────────────
    document.getElementById('btnBack2').addEventListener('click', () => {
        clearErrors();
        step2.classList.add('d-none');
        step1.classList.remove('d-none');
        goToStep1();
    });

    // ── Load modules ──────────────────────────────────────────
    const loadModules = async (diplomaId) => {
        moduleList.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem 0"><div class="spinner-border text-primary" style="width:1.5rem;height:1.5rem"></div></div>';
        try {
            const modules = await apiRequest(`/api/modules/diploma/${diplomaId}`);
            moduleList.innerHTML = '';

            if (!modules.length) {
                moduleList.innerHTML = '<p class="text-center text-muted" style="grid-column:1/-1">No modules found for this diploma.</p>';
                return;
            }

            modules.forEach(m => {
                const item = document.createElement('div');
                item.className = 'module-item';
                item.dataset.id = m.module_id;
                item.innerHTML = `
                    <span class="mod-code">${m.code}</span>
                    <span class="mod-name">${m.name}</span>
                `;

                item.addEventListener('click', () => {
                    clearErrors();
                    if (selectedModules.has(m.module_id)) {
                        selectedModules.delete(m.module_id);
                        item.classList.remove('selected');
                    } else {
                        selectedModules.add(m.module_id);
                        item.classList.add('selected');
                    }
                });

                moduleList.appendChild(item);
            });
        } catch (err) {
            moduleList.innerHTML = '<p class="text-center text-danger" style="grid-column:1/-1">Error loading modules.</p>';
        }
    };

    // ── Finish ────────────────────────────────────────────────
    document.getElementById('btnFinish').addEventListener('click', async () => {
        clearErrors();

        if (selectedModules.size === 0) {
            showError('errModules', 'Please select at least one module.');
            return;
        }

        const data = {
            institution_id: parseInt(instSelect.value),
            diploma_id:     parseInt(dipSelect.value),
            year:           parseInt(yearSelect.value),
            module_ids:     Array.from(selectedModules)
        };

        try {
            const res = await apiRequest('/api/users/onboarding', 'PUT', data);
            if (res.user) {
                const user = auth.getUser();
                auth.setUser({ ...user, ...res.user });

                // Show success modal
                const successModal = new bootstrap.Modal(document.getElementById('successModal'));
                successModal.show();
            } else {
                alert(res.message || 'Failed to save profile.');
            }
        } catch (err) {
            alert('Something went wrong. Please try again.');
        }
    });

    // ── Dashboard redirect ────────────────────────────────────
    const btnDashboard = document.getElementById('btnGoToDashboard');
    if (btnDashboard) {
        btnDashboard.addEventListener('click', () => {
            const modalEl = document.getElementById('successModal');
            const bsModal = bootstrap.Modal.getInstance(modalEl);
            if (bsModal) bsModal.hide();
            window.location.href = 'home.html';
        });
    }
});
