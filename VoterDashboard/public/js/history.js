// history.js
function renderHistory() {
    const container = document.getElementById('historyContainer');
    if (!container) return;

    // Show loading state
    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">⏳</div>
            <h3 style="color:var(--crimson-dark); margin-bottom:10px;">Loading History</h3>
            <p>Please wait...</p>
        </div>`;

    // Get user from session
    const user = JSON.parse(sessionStorage.getItem('user'));
    if (!user) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔒</div>
                <h3 style="color:var(--crimson-dark); margin-bottom:10px;">Not Logged In</h3>
                <p>Please log in to view your voting history.</p>
            </div>`;
        return;
    }

    // Fetch history from API using either numeric user_id or username fallback
    const userIdentifier = user.user_id || user.username;
    fetch(`/api/voter-dashboard/history/${encodeURIComponent(userIdentifier)}`)
        .then(response => response.json())
        .then(result => {
            if (result.status === 'success') {
                const history = result.data;

                if (history.length === 0) {
                    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📜</div>No voting history found.</div>`;
                    return;
                }

                let rows = history.map(h => `
                    <div class="table-row">
                        <div><strong>${h.candidate}</strong><br><span style="color:var(--text-muted); font-size:12px;">${h.party}</span></div>
                        <div>1 Vote</div>
                        <div class="timestamp-cell">${h.time}</div>
                    </div>
                `).join('');

                container.innerHTML = `<div class="history-table">
                    <div class="table-header"><div>Candidate</div><div>Action</div><div>Timestamp</div></div>
                    ${rows}</div>`;
            } else {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">❌</div>
                        <h3 style="color:var(--crimson-dark); margin-bottom:10px;">Error Loading History</h3>
                        <p>${result.message || 'Failed to load voting history'}</p>
                    </div>`;
            }
        })
        .catch(error => {
            console.error('History loading error:', error);
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">❌</div>
                    <h3 style="color:var(--crimson-dark); margin-bottom:10px;">Connection Error</h3>
                    <p>Unable to load voting history. Please try again later.</p>
                </div>`;
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

    // Load history data
    renderHistory();
});