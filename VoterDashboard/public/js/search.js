// search.js
function performSearch() {
    const searchInput = document.getElementById('searchInput');
    const container = document.getElementById('searchResultsContainer');

    if (!searchInput || !container) return;

    let q = searchInput.value.toLowerCase().trim();

    // Show loading state
    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">🔍</div>
            <h3 style="color:var(--crimson-dark); margin-bottom:10px;">Searching...</h3>
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

                // Filter candidates based on search query
                let res = candidates.filter(c =>
                    (c.name && c.name.toLowerCase().includes(q)) ||
                    (c.display_id && c.display_id.toLowerCase().includes(q)) ||
                    (c.policies && c.policies.toLowerCase().includes(q))
                );

                if (res.length === 0) {
                    container.innerHTML = `
                        <div class="empty-state">
                            <div class="empty-icon">🔍</div>
                            <p>No results found for "${q}"</p>
                        </div>`;
                    return;
                }

                let html = res.map(c => `
                    <div class="search-result-item">
                        <div>
                            <strong>${c.name || `Candidate ${c.candidate_id}`}</strong>
                            <span style="color:var(--text-muted); font-size:13px; margin-left:8px;">(${c.display_id || c.candidate_id})</span>
                            ${c.policies ? `<br><span style="color:var(--text-muted); font-size:12px;">${c.policies.substring(0, 100)}${c.policies.length > 100 ? '...' : ''}</span>` : ''}
                        </div>
                        <div class="result-score">${c.score || 0} Votes</div>
                    </div>
                `).join('');

                container.innerHTML = html;
            } else {
                throw new Error(result.message || 'Failed to load candidates');
            }
        })
        .catch(error => {
            console.error('Search error:', error);
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">❌</div>
                    <h3 style="color:var(--crimson-dark); margin-bottom:10px;">Search Error</h3>
                    <p>Unable to perform search. Please try again later.</p>
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

    // Set up search input listener
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', performSearch);
        // Initial load
        performSearch();
    }
});