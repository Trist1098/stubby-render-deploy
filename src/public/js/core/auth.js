const API_URL = 'http://localhost:3000';

const auth = {
  setToken: (token) => localStorage.setItem('token', token),
  getToken: () => localStorage.getItem('token'),
  setUser: (user) => localStorage.setItem('user', JSON.stringify(user)),
  getUser: () => JSON.parse(localStorage.getItem('user')),
  logout: () => {
    localStorage.clear();
    window.location.href = 'login.html';
  },
  isLoggedIn: () => !!localStorage.getItem('token')
};

async function apiRequest(endpoint, method = 'GET', data = null) {
  const headers = { 'Content-Type': 'application/json' };
  const token = auth.getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const options = { method, headers };
  if (data) options.body = JSON.stringify(data);

  try {
    const response = await fetch(`${API_URL}${endpoint}`, options);
    if (response.status === 401) auth.logout();
    return await response.json();
  } catch (err) {
    console.error('API Error:', err);
    return { message: 'Network error' };
  }
}

window.auth = auth;
window.apiRequest = apiRequest;
