// dashboard.js
function updateDashboard() {
    // Show loading state
    document.getElementById('totalVoters').innerText = 'Loading...';
    document.getElementById('totalCandidates').innerText = 'Loading...';
    document.getElementById('totalVotes').innerText = 'Loading...';
    document.getElementById('votingPercent').innerText = 'Loading...';

    // Get user from session
    const user = JSON.parse(sessionStorage.getItem('user'));
    if (!user) {
        document.getElementById('totalVoters').innerText = 'Not logged in';
        return;
    }

    // Fetch active term and candidates
    fetch('/api/voter-dashboard/terms')
        .then(response => response.json())
        .then(result => {
            if (result.status === 'success') {
                const activeTerm = result.data.find(term => term.is_active === 1) || result.data[0];
                if (activeTerm) {
                    // Fetch candidates for active term
                    return fetch(`/api/voter-dashboard/candidates?term_id=${activeTerm.term_id}`);
                } else {
                    throw new Error('No terms available');
                }
            } else {
                throw new Error(result.message || 'Failed to load terms');
            }
        })
        .then(response => response.json())
        .then(result => {
            if (result.status === 'success') {
                const candidates = result.data;
                const totalVotes = candidates.reduce((sum, c) => sum + (c.score || 0), 0);

                document.getElementById('totalVoters').innerText = result.total_voters.toLocaleString();
                document.getElementById('totalCandidates').innerText = candidates.length;
                document.getElementById('totalVotes').innerText = totalVotes.toLocaleString();
                document.getElementById('votingPercent').innerText = result.total_voters > 0
                    ? ((totalVotes / result.total_voters) * 100).toFixed(1) + "%"
                    : "0.0%";
            } else {
                throw new Error(result.message || 'Failed to load candidates');
            }
        })
        .catch(error => {
            console.error('Dashboard loading error:', error);
            document.getElementById('totalVoters').innerText = 'Error';
            document.getElementById('totalCandidates').innerText = 'Error';
            document.getElementById('totalVotes').innerText = 'Error';
            document.getElementById('votingPercent').innerText = 'Error';
        });
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

    // Load dashboard data
    updateDashboard();
});