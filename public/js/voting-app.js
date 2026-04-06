(function attachVotingApp() {
  const USER_STORAGE_KEY = 'user';
  const API_ORIGIN = 'http://127.0.0.1:3000';
  const SAME_APP_HOSTS = new Set(['127.0.0.1:3000', 'localhost:3000']);
  const API_BASE = window.location.protocol === 'file:' || !SAME_APP_HOSTS.has(window.location.host)
    ? API_ORIGIN
    : '';

  // ตรวจชนิดข้อมูลว่าเป็น plain object จริงหรือไม่
  function isPlainObject(value) {
    return Object.prototype.toString.call(value) === '[object Object]';
  }

  // ฟังก์ชันกลางสำหรับเรียก API ของระบบ
  async function api(path, options = {}) {
    const request = { ...options };
    const headers = { ...(options.headers || {}) };

    // ถ้าส่ง body เป็น object ให้แปลงเป็น JSON อัตโนมัติ
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
      // แจ้งข้อความที่เข้าใจง่ายเวลาต่อ backend ไม่ได้
      const message = API_BASE
        ? `Cannot reach the backend server at ${API_ORIGIN}. Keep \`node server.js\` running while you use Live Server.`
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

  // อ่านข้อมูลผู้ใช้ที่เก็บไว้ใน localStorage
  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_STORAGE_KEY));
    } catch (error) {
      return null;
    }
  }

  // บันทึกข้อมูลผู้ใช้ลง localStorage
  function setUser(user) {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  }

  // ลบ session ผู้ใช้จาก localStorage
  function clearUser() {
    localStorage.removeItem(USER_STORAGE_KEY);
  }

  // พาไปหน้า login (ใช้ path จาก root เพื่อให้ใช้ได้ทั้ง file:// และ http://)
  function redirectToLogin() {
    const loginPath = window.location.protocol === 'file:'
      ? '../../index-Login-register(tua)/public/Login.html' // หากเปิดไฟล์โดยตรง
      : '/Login'; // หากใช้ server (มี route รองรับใน app.js)
    window.location.href = loginPath;
  }

  // เช็ก role ของผู้ใช้ก่อนเข้าใช้งานหน้า dashboard
  function requireRole(role) {
    const user = getUser();

    if (!user || (role && user.role !== role)) {
      redirectToLogin();
      return null;
    }

    return user;
  }

  // ออกจากระบบแล้วพากลับหน้า login
  function logout() {
    clearUser();
    redirectToLogin();
  }

  // ป้องกัน HTML injection ตอนแสดงผลข้อความจาก API
  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  // แปลงค่า boolean เป็นข้อความสถานะ
  function formatToggle(value) {
    return value ? 'Enabled' : 'Disabled';
  }

  // แปลง path ของไฟล์ให้ใช้งานได้ทั้ง local file และ server
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
