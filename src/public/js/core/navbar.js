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

  const ensureBadge = (target, role) => {
    if (!target) return null;

    let badge =
      target.querySelector(`[data-match-request-badge="${role}"]`) ||
      target.querySelector(role === 'nav' ? '#matchmakingNavBadge' : '#navRequestBadge');

    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'match-nav-badge d-none';
      badge.dataset.matchRequestBadge = role;

      const dropdownIcon = target.querySelector('.nav-dropdown-icon');
      if (dropdownIcon && dropdownIcon.parentNode === target) {
        target.insertBefore(badge, dropdownIcon);
      } else {
        target.appendChild(badge);
      }
    }

    return badge;
  };

  const getMatchRequestBadges = () => {
    const navLinks = Array.from(document.querySelectorAll('.nav-link')).filter((link) => {
      const href = link.getAttribute('href') || '';
      return href.startsWith('matchmaking.html') || link.textContent.includes('Matchmaking');
    });

    const requestLinks = Array.from(
      document.querySelectorAll('#tab-requests, a.dropdown-item[href*="matchmaking.html?tab=requests"]')
    );

    navLinks.forEach((link) => {
      link.classList.add('d-flex', 'align-items-center', 'gap-1');
      ensureBadge(link, 'nav');
    });

    requestLinks.forEach((link) => {
      link.classList.add('d-flex', 'align-items-center', 'justify-content-between', 'gap-2');
      ensureBadge(link, 'requests');
    });

    return document.querySelectorAll('[data-match-request-badge], #matchmakingNavBadge, #navRequestBadge');
  };

  const setMatchRequestBadges = (count) => {
    const safeCount = Number(count) || 0;
    getMatchRequestBadges().forEach((badge) => {
      badge.textContent = safeCount.toString();
      badge.classList.toggle('d-none', safeCount <= 0);
    });
  };

  const refreshMatchRequestBadges = async () => {
    const activeToken = localStorage.getItem('token');
    getMatchRequestBadges();
    if (!activeToken) {
      setMatchRequestBadges(0);
      return;
    }

    try {
      const res = await fetch('/api/matches/requests/received?limit=1&offset=0', {
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      if (!res.ok) return;
      const requests = await res.json();
      const pending = Array.isArray(requests) && requests[0]?.pending_count
        ? parseInt(requests[0].pending_count, 10)
        : 0;
      setMatchRequestBadges(pending);
    } catch {
      setMatchRequestBadges(0);
    }
  };

  refreshMatchRequestBadges();

  window.addEventListener('matchRequestCountUpdated', (event) => {
    setMatchRequestBadges(event.detail?.pending || 0);
  });

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
    refreshMatchRequestBadges();
  });
});
