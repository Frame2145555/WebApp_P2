const state = {
    user: null,
    terms: [],
    selectedTermId: null,
    term: null,
    candidates: [],
    totalVoters: 0,
    userHasVoted: false,
    selectedCandidate: null
};

function redirectToLogin() {
    const loginPath = window.location.protocol === 'file:'
        ? '../../index-Login-register(tua)/public/Login.html'
        : '/Login';
    window.location.href = loginPath;
}

function getSessionUser() {
    try {
        return JSON.parse(sessionStorage.getItem('user'));
    } catch (error) {
        return null;
    }
}

function setLoadingState(message) {
    const container = document.getElementById('voteContainer');
    if (!container) return;
    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">⏳</div>
            <h3 style="color:var(--crimson-dark); margin-bottom:10px;">${message}</h3>
            <p>Please wait...</p>
        </div>`;
}

async function fetchTerms() {
    const result = await VotingApp.api('/api/voter-dashboard/terms');
    state.terms = result.data || [];

    const select = document.getElementById('termSelect');
    select.innerHTML = state.terms.map(term => {
        const label = `${term.name || term.term_id} - ${term.description || 'Term'}`;
        return `<option value="${term.term_id}">${VotingApp.escapeHtml(label)}</option>`;
    }).join('');

    const active = state.terms.find(term => term.is_active === 1) || state.terms[0];
    state.selectedTermId = active ? active.term_id : null;
    if (state.selectedTermId) {
        select.value = String(state.selectedTermId);
    }

    select.addEventListener('change', () => {
        state.selectedTermId = Number(select.value);
        loadCandidates();
    });
}

async function loadCandidates() {
    if (!state.selectedTermId) {
        setLoadingState('No terms available');
        return;
    }

    setLoadingState('Loading candidates');

    const query = new URLSearchParams({
        term_id: state.selectedTermId,
        user_id: state.user.user_id
    });

    const result = await VotingApp.api(`/api/voter-dashboard/candidates?${query.toString()}`);

    state.term = result.term || null;
    state.candidates = result.data || [];
    state.totalVoters = result.total_voters || 0;
    state.userHasVoted = Boolean(result.user_has_voted);

    renderTermInfo();
    renderVotingSection();
}

function renderTermInfo() {
    if (!state.term) return;
    const title = state.term.description || `Term ${state.term.name || state.term.term_id}`;

    document.getElementById('termTitle').innerText = title;
    document.getElementById('termDesc').innerText = `Term ID: ${state.term.term_id}`;

    const statusBadge = document.getElementById('termStatus');
    statusBadge.innerText = state.term.is_active ? 'Active Term' : 'Closed Term';
    statusBadge.style.background = state.term.is_active ? 'var(--gold)' : 'var(--cream-dark)';
    statusBadge.style.color = state.term.is_active ? 'var(--crimson-dark)' : 'var(--text-mid)';

    document.getElementById('termVoters').innerText = `Voters: ${state.totalVoters.toLocaleString()}`;
    document.getElementById('termVoteStatus').innerText = state.userHasVoted
        ? 'Status: Voted'
        : 'Status: Ready';
}

function renderVotingSection() {
    const container = document.getElementById('voteContainer');
    if (!container) return;

    if (!state.term) {
        container.innerHTML = '<div class="empty-state">No term selected</div>';
        return;
    }

    if (state.userHasVoted) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon" style="color:#4CAF50">✅</div>
                <h3 style="color:var(--crimson-dark); margin-bottom:10px;">You have already voted!</h3>
                <p>Thank you for participating. You cannot vote again for this term.</p>
            </div>`;
        return;
    }

    if (!state.term.is_active) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔒</div>
                <h3 style="color:var(--crimson-dark); margin-bottom:10px;">This term is closed</h3>
                <p>Voting is not available for this term.</p>
            </div>`;
        return;
    }

    if (state.candidates.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">👤</div>
                <h3 style="color:var(--crimson-dark); margin-bottom:10px;">No candidates found</h3>
                <p>Please wait for candidates to be approved.</p>
            </div>`;
        return;
    }

    container.innerHTML = `
        <div class="alert-box">
            <strong>Note:</strong> You can only vote ONCE. Choose your candidate carefully.
        </div>
        <div class="candidates-grid">
            ${state.candidates.map(c => {
                const name = c.name || c.display_id || `Candidate #${c.candidate_id}`;
                const avatar = c.profile_picture
                    ? `<img src="${VotingApp.resolveAssetUrl(c.profile_picture)}" alt="${VotingApp.escapeHtml(name)}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`
                    : '👤';
                return `
                    <div class="candidate-card">
                        <div class="candidate-avatar">${avatar}</div>
                        <div class="candidate-name">${VotingApp.escapeHtml(name)}</div>
                        <div class="candidate-party">ID: ${VotingApp.escapeHtml(c.display_id || '-')}</div>
                        <div class="candidate-actions">
                            <button class="vote-btn" onclick="confirmVote(${c.candidate_id})">Vote Now</button>
                        </div>
                    </div>`;
            }).join('')}
        </div>`;
}

function confirmVote(id) {
    if (state.userHasVoted) {
        alert('You have already voted!');
        return;
    }
    if (!state.term?.is_active) {
        alert('Voting is closed for this term.');
        return;
    }

    state.selectedCandidate = state.candidates.find(c => c.candidate_id === id);
    if (!state.selectedCandidate) return;

    const name = state.selectedCandidate.name || state.selectedCandidate.display_id || 'Candidate';
    document.getElementById('confirmName').innerText = name;
    document.getElementById('confirmParty').innerText = 'Please confirm your choice before submitting.';
    openModal('confirmVoteModal');
}

async function processVote() {
    if (!state.selectedCandidate) return;
    closeModal('confirmVoteModal');

    try {
        const result = await VotingApp.api('/api/voter-dashboard/submit', {
            method: 'POST',
            body: {
                user_id: state.user.user_id,
                candidate_id: state.selectedCandidate.candidate_id
            }
        });

        if (result.status === 'success') {
            state.userHasVoted = true;
            await loadCandidates();

            document.getElementById('successCandidate').innerText =
                state.selectedCandidate.name || state.selectedCandidate.display_id || 'Candidate';
            document.getElementById('successTime').innerText = new Date().toLocaleString('th-TH');
            openModal('successModal');
        } else {
            alert(result.message || 'Voting failed.');
        }
    } catch (error) {
        alert(error?.data?.message || error.message || 'Cannot submit vote.');
    }
}

function finishVotingFlow() {
    closeModal('successModal');
}

function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('active');
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('active');
}

function handleLogout() {
    sessionStorage.removeItem('user');
    redirectToLogin();
}

async function initVotePage() {
    state.user = getSessionUser();
    if (!state.user) {
        redirectToLogin();
        return;
    }

    const logoutButton = document.querySelector('.logout-btn');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }

    try {
        await fetchTerms();
        await loadCandidates();
    } catch (error) {
        console.error('Vote init error:', error);
        setLoadingState('Unable to load voting data');
    }
}

window.confirmVote = confirmVote;
window.processVote = processVote;
window.finishVotingFlow = finishVotingFlow;
window.closeModal = closeModal;

window.addEventListener('DOMContentLoaded', initVotePage);