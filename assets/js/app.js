(function attachVotingApp() {
  const USER_STORAGE_KEY = 'user';
  const API_ORIGIN = 'http://127.0.0.1:3000';
  const SAME_APP_HOSTS = new Set(['127.0.0.1:3000', 'localhost:3000']);
  const API_BASE = window.location.protocol === 'file:' || !SAME_APP_HOSTS.has(window.location.host)
    ? API_ORIGIN
    : '';

  function isPlainObject(value) {
    return Object.prototype.toString.call(value) === '[object Object]';
  }

  async function api(path, options = {}) {
    const request = { ...options };
    const headers = { ...(options.headers || {}) };

    if (isPlainObject(request.body)) {
      request.body = JSON.stringify(request.body);
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }

    request.headers = headers;

    const requestUrl = path.startsWith('http') ? path : `${API_BASE}${path}`;
    let response;

    try {
      response = await fetch(requestUrl, request);
    } catch (error) {
      const message = API_BASE
        ? `Cannot reach the backend server at ${API_ORIGIN}. Keep the Node server running while you use this page.`
        : 'Cannot reach the backend server. Start the app server and try again.';
      const requestError = new Error(message);
      requestError.cause = error;
      throw requestError;
    }

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : null;

    if (!response.ok) {
      const error = new Error(data?.message || `Request failed with status ${response.status}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_STORAGE_KEY));
    } catch (error) {
      return null;
    }
  }

  function setUser(user) {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  }

  function clearUser() {
    localStorage.removeItem(USER_STORAGE_KEY);
  }

  function redirectToLogin() {
    window.location.href = 'login.html';
  }

  function requireRole(role) {
    const user = getUser();

    if (!user || (role && user.role !== role)) {
      redirectToLogin();
      return null;
    }

    return user;
  }

  function logout() {
    clearUser();
    redirectToLogin();
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function formatToggle(value) {
    return value ? 'Enabled' : 'Disabled';
  }

  function resolveAssetUrl(path) {
    if (!path) {
      return '';
    }

    if (/^https?:\/\//i.test(path)) {
      return path;
    }

    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    if (normalizedPath.startsWith('/uploads/')) {
      return `${API_BASE}${normalizedPath}`;
    }

    return path;
  }

  window.VotingApp = {
    API_BASE,
    api,
    getUser,
    setUser,
    clearUser,
    requireRole,
    logout,
    escapeHtml,
    formatToggle,
    resolveAssetUrl
  };
})();
