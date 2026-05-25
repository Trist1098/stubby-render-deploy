const API_URL = 'http://localhost:3000';
const DARK_THEME_CLASS = 'theme-dark';

const applyThemeMode = (isDark) => {
  document.documentElement.classList.toggle(DARK_THEME_CLASS, isDark);
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';

  if (document.body) {
    document.body.classList.toggle(DARK_THEME_CLASS, isDark);
  }
};

const applySavedTheme = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user'));
    applyThemeMode(user?.theme === 'Dark');
  } catch {
    applyThemeMode(false);
  }
};

applySavedTheme();

const auth = {
  setToken: (token) => localStorage.setItem('token', token),

  getToken: () => localStorage.getItem('token'),

  setUser: (user) => {
    localStorage.setItem('user', JSON.stringify(user));
    applySavedTheme();
  },

  getUser: () => JSON.parse(localStorage.getItem('user')),

  logout: () => {
    localStorage.clear();
    window.location.href = 'login.html';
  },

  isLoggedIn: () => !!localStorage.getItem('token'),
};

document.addEventListener('DOMContentLoaded', applySavedTheme);
window.addEventListener('storage', (event) => {
  if (event.key === 'user' || event.key === null) {
    applySavedTheme();
  }
});

async function apiRequest(endpoint, method = 'GET', data = null) {
  const headers = {
    'Content-Type': 'application/json',
  };

  const token = auth.getToken();

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = { method, headers };

  if (data) {
    options.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, options);

    // Avoid logout loop on login request
    if (response.status === 401 && endpoint !== '/api/users/login') {
      auth.logout();
    }

    return await response.json();
  } catch (err) {
    console.error('API Error:', err);

    return {
      message: 'Network error',
    };
  }
}

window.auth = auth;
window.apiRequest = apiRequest;
window.API_URL = API_URL;
window.applySavedTheme = applySavedTheme;
window.applyThemeMode = applyThemeMode;
