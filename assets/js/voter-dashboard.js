document.addEventListener('DOMContentLoaded', async () => {
  const user = VotingApp.requireRole('voter');

  if (!user) {
    return;
  }

  const elements = {
    username: document.getElementById('username'),
    userId: document.getElementById('userId'),
    userUsername: document.getElementById('userUsername'),
    userRole: document.getElementById('userRole'),
    votingStatus: document.getElementById('votingStatusMessage'),
    candidates: document.getElementById('candidateList'),
    selectedCandidate: document.getElementById('selectedCandidateValue'),
    logoutButton: document.getElementById('logoutButton')
  };

  const state = {
    candidates: [],
    systemStatus: null,
    voteStatus: { hasVoted: false, candidateId: null }
  };

  elements.username.textContent = user.username;
  elements.userId.textContent = user.user_id;
  elements.userUsername.textContent = user.username;
  elements.userRole.textContent = user.role.toUpperCase();
  elements.logoutButton.addEventListener('click', VotingApp.logout);

  await loadDashboard();

  async function loadDashboard() {
    try {
      const [systemStatus, candidates, voteStatus] = await Promise.all([
        VotingApp.api('/api/system-status'),
        VotingApp.api('/api/candidates'),
        VotingApp.api(`/api/voters/${user.user_id}/vote-status`)
      ]);

      state.systemStatus = systemStatus;
      state.candidates = candidates;
      state.voteStatus = voteStatus;

      renderStatus();
      renderCandidates();
    } catch (error) {
      elements.votingStatus.textContent = error.message;
      elements.votingStatus.className = 'text-sm font-semibold text-red-600';
      elements.candidates.innerHTML = `
        <div class="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700">
          Unable to load ballot data right now.
        </div>
      `;
    }
  }

  function getSelectedCandidateName() {
    const selectedCandidate = state.candidates.find((candidate) => Number(candidate.candidate_id) === Number(state.voteStatus.candidateId));
    return selectedCandidate?.display_name || selectedCandidate?.username || '--';
  }

  function renderStatus() {
    if (!state.systemStatus?.activeTermId) {
      elements.votingStatus.textContent = 'There is no active election term right now.';
      elements.votingStatus.className = 'text-sm font-semibold text-red-600';
      elements.selectedCandidate.textContent = '--';
      return;
    }

    if (state.voteStatus.hasVoted) {
      elements.votingStatus.textContent = 'Your vote has already been recorded for the active term.';
      elements.votingStatus.className = 'text-sm font-semibold text-green-700';
      elements.selectedCandidate.textContent = getSelectedCandidateName();
      return;
    }

    if (!state.systemStatus.isVotingEnabled) {
      elements.votingStatus.textContent = 'Voting is currently disabled by the system settings.';
      elements.votingStatus.className = 'text-sm font-semibold text-yellow-700';
      elements.selectedCandidate.textContent = '--';
      return;
    }

    elements.votingStatus.textContent = 'Voting is open. Choose one candidate below.';
    elements.votingStatus.className = 'text-sm font-semibold text-mfuRed';
    elements.selectedCandidate.textContent = '--';
  }

  function renderCandidates() {
    if (!state.candidates.length) {
      elements.candidates.innerHTML = `
        <div class="rounded-2xl bg-gray-50 px-5 py-4 text-sm text-gray-500">
          No registered candidates are available for the active term.
        </div>
      `;
      return;
    }

    elements.candidates.innerHTML = state.candidates.map((candidate) => {
      const disabled = state.voteStatus.hasVoted || !state.systemStatus?.isVotingEnabled;
      const candidateName = VotingApp.escapeHtml(candidate.display_name || candidate.username);
      const manifesto = VotingApp.escapeHtml(candidate.bio || 'No manifesto added yet.');
      const profilePicture = candidate.profile_picture
        ? VotingApp.resolveAssetUrl(candidate.profile_picture)
        : 'assets/images/mfu-logo.png';

      return `
        <article class="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm">
          <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-start">
              <img
                src="${profilePicture}"
                alt="${candidateName} profile photo"
                class="h-20 w-20 rounded-[1.5rem] border border-gray-200 bg-gray-50 object-cover shadow-sm"
              >
              <div>
              <p class="text-xs font-bold uppercase tracking-[0.3em] text-gray-400">Candidate</p>
              <h3 class="mt-2 text-2xl font-black text-mfuRed">${candidateName}</h3>
              <p class="mt-4 text-sm leading-7 text-gray-600">${manifesto}</p>
              </div>
            </div>
            <button
              class="vote-button rounded-2xl px-5 py-3 font-bold shadow-sm ${disabled ? 'cursor-not-allowed bg-gray-200 text-gray-500' : 'bg-mfuRed text-white hover:bg-red-900'}"
              data-candidate-id="${candidate.candidate_id}"
              ${disabled ? 'disabled' : ''}
            >
              ${state.voteStatus.hasVoted ? 'Vote Submitted' : 'Vote for This Candidate'}
            </button>
          </div>
        </article>
      `;
    }).join('');

    for (const button of elements.candidates.querySelectorAll('.vote-button')) {
      button.addEventListener('click', async () => {
        const candidateId = Number(button.dataset.candidateId);
        await castVote(candidateId);
      });
    }
  }

  async function castVote(candidateId) {
    elements.votingStatus.textContent = 'Submitting your vote...';
    elements.votingStatus.className = 'text-sm font-semibold text-mfuRed';

    try {
      await VotingApp.api('/api/vote', {
        method: 'POST',
        body: {
          voter_id: user.user_id,
          candidate_id: candidateId
        }
      });

      state.voteStatus = { hasVoted: true, candidateId };
      renderStatus();
      renderCandidates();
    } catch (error) {
      elements.votingStatus.textContent = error.message;
      elements.votingStatus.className = 'text-sm font-semibold text-red-600';
    }
  }
});
