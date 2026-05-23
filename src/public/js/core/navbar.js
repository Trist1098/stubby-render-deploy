/* global auth */

document.addEventListener('DOMContentLoaded', function () {
  const token = localStorage.getItem('token');
  let user = null;

  try {
    const userJson = localStorage.getItem('user');
    user = userJson ? JSON.parse(userJson) : null;
  } catch {
    console.error('Corrupted user data in localStorage');
  }

  // 1. HIGHLIGHT ACTIVE LINK
  const currentPath = window.location.pathname;
  const navLinksList = document.querySelectorAll('.nav-link');

  navLinksList.forEach((link) => {
    if (
      link.getAttribute('href') &&
      (currentPath.endsWith(link.getAttribute('href')) ||
        (currentPath === '/' && link.getAttribute('href') === 'index.html'))
    ) {
      link.classList.add('active');
    }
  });

  // 2. RENDER AUTH LINK
  const renderNavbar = () => {
    const authLink = document.getElementById('auth-link');

    if (!authLink) return;

    if (token && user) {
      authLink.className = 'nav-item dropdown';

      authLink.innerHTML = `
                <div class="dropdown">
                    <button class="btn btn-white fw-bold dropdown-toggle d-flex align-items-center gap-2 text-primary"
                            type="button"
                            data-bs-toggle="dropdown">
                        <div class="rounded-circle bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center user-avatar-sm">
                            ${(user.name || 'U').charAt(0).toUpperCase()}
                        </div>
                        Hi, ${user.name || 'User'}!
                    </button>

                    <div class="dropdown-menu dropdown-menu-end shadow border-0 mt-2">
                        <a href="profile.html" class="dropdown-item py-2">
                            <i class="fas fa-user-circle me-2"></i> Profile
                        </a>

                        <a href="settings.html" class="dropdown-item py-2">
                            <i class="fas fa-cog me-2"></i> Settings
                        </a>

                        <hr class="dropdown-divider">

                        <button id="logoutButton" class="dropdown-item py-2 text-danger">
                            <i class="fas fa-sign-out-alt me-2"></i> Logout
                        </button>
                    </div>
                </div>
            `;

      document.getElementById('logoutButton')?.addEventListener('click', () => {
        if (typeof auth !== 'undefined' && typeof auth.logout === 'function') {
          auth.logout();
        } else {
          localStorage.clear();
          window.location.href = 'login.html';
        }
      });
    } else {
      authLink.innerHTML = `
                <a href="login.html" class="btn btn-primary px-4">
                    Login
                </a>
            `;
    }
  };

  renderNavbar();

  // 3. SCROLL EVENT FOR TRANSPARENT NAVBAR
  const headerEl = document.querySelector('.header-transparent');

  if (headerEl) {
    const handleScroll = () => {
      if (window.scrollY > 100) {
        headerEl.classList.add('scrolled');
      } else {
        headerEl.classList.remove('scrolled');
      }
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll);
  }

  // 4. USER UPDATE EVENT
  window.addEventListener('userUpdated', () => {
    try {
      const userJson = localStorage.getItem('user');
      user = userJson ? JSON.parse(userJson) : null;
    } catch {
      console.error('Corrupted user data in localStorage');
    }

    renderNavbar();
  });
});
