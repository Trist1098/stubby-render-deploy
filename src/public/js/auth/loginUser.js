document.addEventListener("DOMContentLoaded", function () {
  const loginForm = document.getElementById('loginForm');
  if (!loginForm) return;

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const identifier = document.getElementById('identifier').value;
    const password = document.getElementById('password').value;

    try {
      const res = await window.apiRequest('/api/users/login', 'POST', { identifier, password });
      if (res.token) {
        window.auth.setToken(res.token);
        window.auth.setUser(res.user);
        window.location.href = 'index.html';
      } else {
        alert(res.message || 'Login failed. Please check your credentials.');
      }
    } catch {
      alert('Something went wrong. Is the server running?');
    }
  });
});
