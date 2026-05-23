/* global auth, apiRequest */

document.addEventListener('DOMContentLoaded', function () {
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
    document.querySelectorAll('.error-message').forEach((el) => (el.style.display = 'none'));
  };

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const identifier = document.getElementById('identifier').value;
    const password = document.getElementById('password').value;

    let hasError = false;
    if (!identifier) {
      showError('errIdentifier', 'Username or Email is required');
      hasError = true;
    }
    if (!password) {
      showError('errPassword', 'Password is required');
      hasError = true;
    }

    if (hasError) return;

    try {
      const res = await apiRequest('/api/users/login', 'POST', { identifier, password });
      if (res.token) {
        auth.setToken(res.token);
        auth.setUser(res.user);

        // Check if profile is complete
        if (!res.user.institution_id || !res.user.diploma_id) {
          window.location.href = 'onboarding.html';
        } else {
          window.location.href = 'home.html';
        }
      } else {
        showError('errPassword', res.message || 'Login failed. Please check your credentials.');
      }
    } catch {
      showError('errPassword', 'Something went wrong. Is the server running?');
    }
  });
});
