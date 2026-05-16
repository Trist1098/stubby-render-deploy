document.addEventListener("DOMContentLoaded", function () {
    const registerForm = document.getElementById('registerForm');
    if (!registerForm) return;

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

    const validateEmail = (email) => {
        return email.toLowerCase().endsWith('.edu.sg');
    };

    const validatePassword = (password) => {
        // Minimum 8 characters, at least one uppercase letter, one lowercase letter, one number and one special character
        const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        return re.test(password);
    };

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearErrors();

        const name = document.getElementById('name').value;
        const username = document.getElementById('username').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        let hasError = false;

        if (name.length < 2) {
            showError('errName', 'Full name is required');
            hasError = true;
        }

        if (username.length < 3) {
            showError('errUsername', 'Username must be at least 3 characters');
            hasError = true;
        }

        if (!validateEmail(email)) {
            showError('errEmail', 'Please use a valid institution email (.edu.sg)');
            hasError = true;
        }

        if (!validatePassword(password)) {
            showError('errPassword', 'Password must be at least 8 characters, with at least one uppercase letter, one lowercase letter, one number and one special character.');
            hasError = true;
        }

        if (hasError) return;

        try {
            const res = await apiRequest('/api/users/register', 'POST', { name, username, email, password });
            if (res.token) {
                auth.setToken(res.token);
                auth.setUser(res.user);
                // Redirect to onboarding after successful registration
                window.location.href = 'onboarding.html';
            } else {
                showError('errUsername', res.message || 'Registration failed. Username or Email may already be taken.');
            }
        } catch (err) {
            showError('errUsername', 'Something went wrong. Please try again later.');
        }
    });
});
