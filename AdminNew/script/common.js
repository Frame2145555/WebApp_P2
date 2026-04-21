document.addEventListener('DOMContentLoaded', async () => {
  // เช็ค session ทุกครั้งที่โหลดหน้า ถ้าหมดให้ redirect ไป login
  try {
    const res = await fetch('/api/me');
    if (!res.ok) {
      window.location.href = '/Login';
      return;
    }
  } catch {
    window.location.href = '/Login';
    return;
  }

  const logoutButton = document.getElementById('logout-Btn');
  if (!logoutButton) return;

  logoutButton.addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/Login';
  });
});
