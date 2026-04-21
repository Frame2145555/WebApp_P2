document.addEventListener('DOMContentLoaded', () => {
  const logoutButton = document.getElementById('logout-Btn');
  if (!logoutButton) {
    return;
  }

  // ปุ่ม logout กลางของทุกหน้าใน AdminNew
  logoutButton.addEventListener('click', () => {
    window.location.href = '/public/index.html';
  });
});
