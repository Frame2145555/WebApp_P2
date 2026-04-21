// search.js
let cachedCandidates = [];
let searchTimer = null;

function normalizeSearchValue(value) {
    return String(value || '').toLowerCase().trim();
}

function getCandidateName(candidate) {
    return candidate.name || `Candidate ${candidate.candidate_id}`;
}

function getCandidateParty(candidate) {
    // รองรับหลายชื่อฟิลด์เพื่อให้ค้นหา "party" ได้แม้ backend ใช้ชื่อไม่เหมือนกัน
    return candidate.party ||
        candidate.party_name ||
        candidate.partyName ||
        candidate.group_name ||
        candidate.display_id ||
        '';
}

function renderSearchResults(results, queryText) {
    const container = document.getElementById('searchResultsContainer');
    if (!container) return;

    if (results.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔍</div>
                <p>No results found for "${VotingApp.escapeHtml(queryText)}"</p>
            </div>`;
        return;
    }

    const html = results.map(c => {
        const name = getCandidateName(c);
        const party = getCandidateParty(c);
        const policyText = c.policies ? `${c.policies.substring(0, 100)}${c.policies.length > 100 ? '...' : ''}` : '';

        return `
            <div class="search-result-item">
                <div>
                    <strong>${VotingApp.escapeHtml(name)}</strong>
                    <span style="color:var(--text-muted); font-size:13px; margin-left:8px;">(${VotingApp.escapeHtml(c.display_id || c.candidate_id)})</span>
                    ${party ? `<br><span style="color:var(--text-muted); font-size:12px;">Party: ${VotingApp.escapeHtml(party)}</span>` : ''}
                    ${policyText ? `<br><span style="color:var(--text-muted); font-size:12px;">${VotingApp.escapeHtml(policyText)}</span>` : ''}
                </div>
                <div class="result-score">${c.score || 0} Votes</div>
            </div>`;
    }).join('');

    container.innerHTML = html;
}

function performSearch() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;

    const query = normalizeSearchValue(searchInput.value);

    const filtered = cachedCandidates.filter(c => {
        const name = normalizeSearchValue(getCandidateName(c));
        const party = normalizeSearchValue(getCandidateParty(c));

        return name.includes(query) || party.includes(query);
    });

    renderSearchResults(filtered, searchInput.value.trim());
}

function performSearchDebounced() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(performSearch, 200);
}

function loadSearchCandidates() {
    const container = document.getElementById('searchResultsContainer');
    if (!container) return;

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
            if (result.status !== 'success') {
                throw new Error(result.message || 'Failed to load terms');
            }

            const activeTerm = result.data.find(term => term.is_active === 1) || result.data[0];
            if (!activeTerm) {
                throw new Error('No active terms available');
            }

            return fetch(`/api/voter-dashboard/candidates?term_id=${activeTerm.term_id}`);
        })
        .then(response => response.json())
        .then(result => {
            if (result.status !== 'success') {
                throw new Error(result.message || 'Failed to load candidates');
            }

            cachedCandidates = result.data || [];
            performSearch();
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
        searchInput.addEventListener('input', performSearchDebounced);
        searchInput.addEventListener('keydown', function(event) {
            if (event.key === 'Enter') {
                performSearch();
            }
        });
        // Initial load
        loadSearchCandidates();
    }
});