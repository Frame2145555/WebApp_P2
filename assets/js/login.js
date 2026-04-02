document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const message = document.getElementById('message');

  function setMessage(text, isError = false) {
    message.textContent = text;
    message.className = `mt-6 text-xs font-bold uppercase ${isError ? 'text-red-600' : 'text-mfuRed'}`;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const username = String(formData.get('username') || '').trim();
    const password = String(formData.get('password') || '');

    if (!username || !password) {
      setMessage('Username and password are required.', true);
      return;
    }

    setMessage('Authenticating...');

    try {
      const data = await VotingApp.api('/api/login', {
        method: 'POST',
        body: { username, password }
      });

      VotingApp.setUser(data.user);
      window.location.href = data.redirect;
    } catch (error) {
      setMessage(error.message, true);
    }
  });
});
