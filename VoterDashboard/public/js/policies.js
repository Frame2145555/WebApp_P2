// policies.js
function renderPolicies() {
    const container = document.getElementById('candidatesGridPolicies');
    if (!container) return;

    // Show loading state
    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">⏳</div>
            <h3 style="color:var(--crimson-dark); margin-bottom:10px;">Loading Policies</h3>
            <p>Please wait...</p>
        </div>`;

    // Fetch active term and candidates
    fetch('/api/voter-dashboard/terms')
        .then(response => response.json())
        .then(result => {
            if (result.status === 'success') {
                const activeTerm = result.data.find(term => term.is_active === 1) || result.data[0];
                if (activeTerm) {
                    return fetch(`/api/voter-dashboard/candidates?term_id=${activeTerm.term_id}`);
                } else {
                    throw new Error('No active terms available');
                }
            } else {
                throw new Error(result.message || 'Failed to load terms');
            }
        })
        .then(response => response.json())
        .then(result => {
            if (result.status === 'success') {
                const candidates = result.data;

                if (candidates.length === 0) {
                    container.innerHTML = `
                        <div class="empty-state">
                            <div class="empty-icon">👤</div>
                            <h3 style="color:var(--crimson-dark); margin-bottom:10px;">No Candidates Found</h3>
                            <p>No candidates are available for the current term.</p>
                        </div>`;
                    return;
                }

                const html = candidates.map(c => `
                    <div class="candidate-card">
                        <div class="candidate-avatar">${c.name ? c.name.charAt(0).toUpperCase() : 'C'}</div>
                        <div class="candidate-name">${c.name || `Candidate ${c.candidate_id}`}</div>
                        <div class="candidate-party">ID: ${c.display_id || c.candidate_id}</div>
                        <button class="policy-btn" onclick="viewPolicy(${c.candidate_id}, '${c.name || 'Candidate'}', '${c.policies || 'No policies available'}')">Read Policy</button>
                    </div>
                `).join('');

                container.innerHTML = html;
            } else {
                throw new Error(result.message || 'Failed to load candidates');
            }
        })
        .catch(error => {
            console.error('Policies loading error:', error);
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">❌</div>
                    <h3 style="color:var(--crimson-dark); margin-bottom:10px;">Error Loading Policies</h3>
                    <p>Unable to load candidate policies. Please try again later.</p>
                </div>`;
        });
}

function viewPolicy(candidateId, candidateName, policies) {
    document.getElementById('policyTitle').innerText = `${candidateName}'s Policy`;
    document.getElementById('policyContent').innerText = policies;
    document.getElementById('policyModal').classList.add('active');
}

function redirectToLogin() {
    const loginPath = window.location.protocol === 'file:'
        ? '../../index-Login-register(tua)/public/Login.html'
        : '/Login';
    window.location.href = loginPath;
}

function handleLogout() {
    sessionStorage.removeItem('user');
    redirectToLogin();
}

document.addEventListener('DOMContentLoaded', function() {
    const logoutButton = document.querySelector('.logout-btn');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }

    // Load policies data
    renderPolicies();
});