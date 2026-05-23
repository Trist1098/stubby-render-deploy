const API_URL = 'http://localhost:3000';

const applySavedTheme = () => {
    try {
        const user = JSON.parse(localStorage.getItem('user'));

        document.body.classList.toggle(
            'theme-dark',
            user?.theme === 'Dark'
        );
    } catch {
        document.body.classList.remove('theme-dark');
    }
};

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