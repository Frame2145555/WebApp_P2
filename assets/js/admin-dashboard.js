document.addEventListener('DOMContentLoaded', async () => {
  const user = VotingApp.requireRole('admin');

  if (!user) {
    return;
  }

  const elements = {
    userId: document.getElementById('userId'),
    username: document.getElementById('userUsername'),
    role: document.getElementById('userRole'),
    activeTerm: document.getElementById('activeTermValue'),
    database: document.getElementById('databaseValue'),
    votingStatus: document.getElementById('votingStatusValue'),
    registrationStatus: document.getElementById('registrationStatusValue'),
    totalUsers: document.getElementById('totalUsersValue'),
    totalCandidates: document.getElementById('totalCandidatesValue'),
    totalVotes: document.getElementById('totalVotesValue'),
    summaryStatus: document.getElementById('summaryStatus'),
    resultsPreview: document.getElementById('resultsPreview'),
    logoutButton: document.getElementById('logoutButton')
  };

  elements.userId.textContent = user.user_id;
  elements.username.textContent = user.username;
  elements.role.textContent = user.role.toUpperCase();
  elements.logoutButton.addEventListener('click', VotingApp.logout);

  try {
    const [health, systemStatus, users, candidates, results] = await Promise.all([
      VotingApp.api('/health'),
      VotingApp.api('/api/system-status'),
      VotingApp.api('/api/users'),
      VotingApp.api('/api/candidates'),
      VotingApp.api('/api/results')
    ]);

    const totalVotes = results.reduce((sum, result) => sum + Number(result.vote_count || 0), 0);

    elements.activeTerm.textContent = systemStatus.activeTermId ?? 'None';
    elements.database.textContent = health.database || 'unknown';
    elements.votingStatus.textContent = VotingApp.formatToggle(systemStatus.isVotingEnabled);
    elements.registrationStatus.textContent = VotingApp.formatToggle(systemStatus.isRegistrationEnabled);
    elements.totalUsers.textContent = users.length;
    elements.totalCandidates.textContent = candidates.length;
    elements.totalVotes.textContent = totalVotes;
    elements.summaryStatus.textContent = 'Live database summary loaded.';

    renderResultsPreview(results);
  } catch (error) {
    elements.summaryStatus.textContent = error.message;
    elements.summaryStatus.classList.add('text-red-600');
  }

  function renderResultsPreview(results) {
    if (!results.length) {
      elements.resultsPreview.innerHTML = `
        <div class="rounded-2xl bg-gray-50 px-5 py-4 text-sm text-gray-500">
          No active-term candidate results yet.
        </div>
      `;
      return;
    }

    elements.resultsPreview.innerHTML = results
      .slice(0, 5)
      .map((candidate, index) => `
        <div class="flex items-center justify-between rounded-2xl bg-gray-50 px-5 py-4">
          <div>
            <p class="text-xs uppercase tracking-[0.25em] text-gray-400">Rank ${index + 1}</p>
            <p class="mt-1 text-lg font-bold text-gray-900">${VotingApp.escapeHtml(candidate.display_name || candidate.username)}</p>
          </div>
          <p class="text-2xl font-black text-mfuRed">${Number(candidate.vote_count || 0)}</p>
        </div>
      `)
      .join('');
  }
});
