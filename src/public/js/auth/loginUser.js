document.addEventListener("DOMContentLoaded", function () {
  const loginForm = document.getElementById('loginForm');
  if (!loginForm) return;

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

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const identifier = document.getElementById('identifier').value;
        const password = document.getElementById('password').value;
        
        try {
            const res = await apiRequest('/api/users/login', 'POST', { identifier, password });
            if (res.token) {
                auth.setToken(res.token);
                auth.setUser(res.user);
                window.location.href = 'home.html';
            } else {
                alert(res.message || 'Login failed. Please check your credentials.');
            }
        } catch (err) {
            alert('Something went wrong. Is the server running?');
        }
    });
});
