document.addEventListener("DOMContentLoaded", function () {
    // Check auth first
    if (!auth.isLoggedIn()) { window.location.href = 'login.html'; }
    
    const userData = auth.getUser();
    if (userData) {
        const userEl = document.getElementById('userName');
        const majorEl = document.getElementById('userMajor');
        if (userEl) userEl.textContent = userData.name;
        if (majorEl) majorEl.textContent = userData.username + ' | ' + (userData.email || '');
    }
});
