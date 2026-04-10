// vote.js
let selectedCandidate = null;

function renderVotingSection() {
    const container = document.getElementById('voteContainer');
    if (appData.user.hasVoted) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon" style="color:#4CAF50">✅</div>
                <h3 style="color:var(--crimson-dark); margin-bottom:10px;">You have already voted!</h3>
                <p>Thank you for participating. You cannot vote again.</p>
                <button class="policy-btn" style="margin-top:20px" onclick="switchTab('history', document.querySelectorAll('.menu-item')[4])">View History</button>
            </div>`;
        return;
    }

    container.innerHTML = `
        <div class="alert-box" style="margin-bottom: 24px;">
            <strong>Note:</strong> You can only vote ONCE. Choose your candidate carefully.
        </div>
        <div class="candidates-grid">
            ${appData.candidates.map(c => `
                <div class="candidate-card">
                    <div class="candidate-avatar">${c.initials}</div>
                    <div class="candidate-name">${c.name}</div>
                    <div class="candidate-party">${c.party}</div>
                    <div class="candidate-actions">
                        <button class="vote-btn" onclick="confirmVote(${c.id})">VOTE for ${c.name}</button>
                    </div>
                </div>
            `).join('')}
        </div>`;
}

function confirmVote(id) {
    if (appData.user.hasVoted) return alert("You have already voted!");
    selectedCandidate = appData.candidates.find(x => x.id === id);
    document.getElementById('confirmName').innerText = selectedCandidate.name;
    document.getElementById('confirmParty').innerText = selectedCandidate.party;
    document.getElementById('confirmVoteModal').classList.add('active');
}

function processVote() {
    closeModal('confirmVoteModal');
    selectedCandidate.votes += 1;
    appData.user.hasVoted = true;

    const timestamp = new Date().toLocaleString('en-GB');
    appData.user.history.push({
        candidate: selectedCandidate.name,
        party: selectedCandidate.party,
        time: timestamp
    });

    saveData();
    refreshAllUI();

    document.getElementById('successCandidate').innerText = selectedCandidate.name;
    document.getElementById('successTime').innerText = timestamp;
    document.getElementById('successModal').classList.add('active');
}

function finishVotingFlow() {
    closeModal('successModal');
    switchTab('history', document.querySelectorAll('.menu-item')[4]);
}