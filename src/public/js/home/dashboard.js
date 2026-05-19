document.addEventListener("DOMContentLoaded", function () {
  // Check auth first
  if (!window.auth.isLoggedIn()) {
    window.location.href = 'login.html';
  }

  const userData = window.auth.getUser();
  if (userData) {
    const userEl = document.getElementById('userName');
    const majorEl = document.getElementById('userMajor');
    if (userEl) userEl.textContent = userData.name;
    if (majorEl) majorEl.textContent = userData.username + ' | ' + (userData.email || '');
  }
});
