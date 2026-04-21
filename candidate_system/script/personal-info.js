document.addEventListener('DOMContentLoaded', () => {
  const user = VotingApp.requireRole('candidate');
  if (!user) {
    return;
  }

  const elements = {
    form: document.getElementById('personalInfoForm'),
    fullName: document.getElementById('full_name'),
    studentId: document.getElementById('student_id'),
    faculty: document.getElementById('faculty'),
    major: document.getElementById('major'),
    phone: document.getElementById('phone'),
    email: document.getElementById('email'),
    about: document.getElementById('about'),
    saveButton: document.getElementById('saveButton'),
    formStatus: document.getElementById('formStatus'),
    logoutButton: document.getElementById('logoutButton')
  };

  elements.logoutButton.addEventListener('click', VotingApp.logout);
  elements.form.addEventListener('submit', handleSave);

  loadPersonalInfo();

  async function loadPersonalInfo() {
    setStatus('Loading profile data...', 'default');

    try {
      const result = await VotingApp.api(`/api/candidate/personal-info/${encodeURIComponent(user.user_id)}`);
      const data = result?.data || {};

      elements.fullName.value = data.full_name || '';
      elements.studentId.value = data.student_id || '';
      elements.faculty.value = data.faculty || '';
      elements.major.value = data.major || '';
      elements.phone.value = data.phone || '';
      elements.email.value = data.email || '';
      elements.about.value = data.about || '';

      setStatus('Profile loaded', 'success');
    } catch (error) {
      setStatus(error.message || 'Cannot load personal info', 'error');
    }
  }

  async function handleSave(event) {
    event.preventDefault();
    elements.saveButton.disabled = true;
    setStatus('Saving...', 'default');

    const payload = {
      user_id: user.user_id,
      full_name: elements.fullName.value.trim(),
      student_id: elements.studentId.value.trim(),
      faculty: elements.faculty.value.trim(),
      major: elements.major.value.trim(),
      phone: elements.phone.value.trim(),
      email: elements.email.value.trim(),
      about: elements.about.value.trim()
    };

    try {
      await VotingApp.api('/api/candidate/personal-info', {
        method: 'POST',
        body: payload
      });

      setStatus('Saved successfully', 'success');
    } catch (error) {
      setStatus(error.message || 'Save failed', 'error');
    } finally {
      elements.saveButton.disabled = false;
    }
  }

  function setStatus(message, tone) {
    elements.formStatus.textContent = message;

    if (tone === 'success') {
      elements.formStatus.className = 'text-sm font-semibold text-green-700';
      return;
    }

    if (tone === 'error') {
      elements.formStatus.className = 'text-sm font-semibold text-red-700';
      return;
    }

    elements.formStatus.className = 'text-sm font-semibold text-gray-500';
  }
});
