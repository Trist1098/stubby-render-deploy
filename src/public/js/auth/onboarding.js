document.addEventListener("DOMContentLoaded", function () {
    // Check if user is logged in
    if (!auth.isLoggedIn()) {
        window.location.href = 'login.html';
        return;
    }

    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const dot1 = document.getElementById('dot1');
    const dot2 = document.getElementById('dot2');
    const instSelect = document.getElementById('institutionId');
    const dipSelect = document.getElementById('diplomaId');
    const yearSelect = document.getElementById('year');
    const moduleList = document.getElementById('moduleList');
    
    let selectedModules = new Set();

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

    // Handle select color change (placeholder vs selected)
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
        el.addEventListener('change', () => {
            handleSelectColor(el);
            clearErrors();
        });
    });

    // Load Institutions and Diplomas
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

    // Navigation
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
        dot1.classList.remove('active');
        dot2.classList.add('active');

        // Load modules for the selected diploma
        loadModules(dipSelect.value);
    });

    document.getElementById('btnBack2').addEventListener('click', () => {
        clearErrors();
        step2.classList.add('d-none');
        step1.classList.remove('d-none');
        dot2.classList.remove('active');
        dot1.classList.add('active');
    });

    const loadModules = async (diplomaId) => {
        moduleList.innerHTML = '<div class="col-12 text-center py-4"><div class="spinner-border text-primary"></div></div>';
        try {
            const modules = await apiRequest(`/api/modules/diploma/${diplomaId}`);
            moduleList.innerHTML = '';
            
            if (modules.length === 0) {
                moduleList.innerHTML = '<p class="text-center text-muted">No modules found for this diploma.</p>';
                return;
            }

            modules.forEach(m => {
                const col = document.createElement('div');
                col.className = 'col-12';
                col.innerHTML = `
                    <div class="module-item p-3 rounded-4 d-flex justify-content-between align-items-center" data-id="${m.module_id}">
                        <div>
                            <div class="fw-bold text-dark">${m.code}</div>
                            <div class="small text-muted">${m.name}</div>
                        </div>
                        <i class="fas fa-plus-circle text-muted"></i>
                    </div>
                `;
                
                const item = col.querySelector('.module-item');
                item.addEventListener('click', () => {
                    clearErrors();
                    if (selectedModules.has(m.module_id)) {
                        selectedModules.delete(m.module_id);
                        item.classList.remove('selected');
                        item.querySelector('i').className = 'fas fa-plus-circle text-muted';
                    } else {
                        selectedModules.add(m.module_id);
                        item.classList.add('selected');
                        item.querySelector('i').className = 'fas fa-check-circle text-primary';
                    }
                });
                
                moduleList.appendChild(col);
            });
        } catch (err) {
            moduleList.innerHTML = '<p class="text-center text-danger">Error loading modules.</p>';
        }
    };

    document.getElementById('btnFinish').addEventListener('click', async () => {
        clearErrors();
        
        if (selectedModules.size === 0) {
            showError('errModules', 'Please select at least one module you are taking.');
            return;
        }

        const data = {
            institution_id: parseInt(instSelect.value),
            diploma_id: parseInt(dipSelect.value),
            year: parseInt(yearSelect.value),
            module_ids: Array.from(selectedModules)
        };

        try {
            const res = await apiRequest('/api/users/onboarding', 'PUT', data);
            if (res.user) {
                // Update local user data
                const user = auth.getUser();
                auth.setUser({ ...user, ...res.user });
                
                // Show Success Modal
                const successModal = new bootstrap.Modal(document.getElementById('successModal'));
                successModal.show();

                document.getElementById('btnGoToDashboard').addEventListener('click', () => {
                    window.location.href = 'index.html';
                });
            } else {
                alert(res.message || 'Failed to save profile.');
            }
        } catch (err) {
            alert('Something went wrong. Please try again.');
        }
    });
});
