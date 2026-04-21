document.addEventListener('DOMContentLoaded', () => {
  const logoutButton = document.getElementById('logout-Btn');
  if (!logoutButton) {
    return;
  }

  const loginUrl = `${window.location.protocol}//${window.location.hostname}:3000/Login`;

  // ปุ่ม logout กลางของทุกหน้าใน AdminNew
  logoutButton.addEventListener('click', () => {
    window.location.href = loginUrl;
  });
});
