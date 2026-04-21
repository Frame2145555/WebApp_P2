// search.js
const CURRENT_HOST = window.location.hostname || '127.0.0.1';
const API_CANDIDATE_ORIGINS = window.location.port === '3000'
    ? ['']
    : [
        `${window.location.protocol}//${CURRENT_HOST}:3000`,
        'http://127.0.0.1:3000',
        'http://localhost:3000'
    ];

let latestFilteredCandidates = [];
let allCandidates = [];
let activeTerm = null;
let totalVotersCount = 0;
let hasLoadedCandidates = false;

function getApiUrl(path) {
    const origin = API_CANDIDATE_ORIGINS[0] || '';
    return `${origin}${path}`;
}

async function fetchJsonWithFallback(paths) {
    let lastError = null;

    for (const origin of API_CANDIDATE_ORIGINS) {
        for (const path of paths) {
            try {
                const requestUrl = `${origin}${path}`;
                const response = await fetch(requestUrl);
                const data = await response.json();

                if (!response.ok || data?.status !== 'success') {
                    throw new Error(data?.message || `Request failed for ${requestUrl}`);
                }

                return data;
            } catch (error) {
                lastError = error;
            }
        }
    }

    throw lastError || new Error('Unable to load data from backend');
}

function escapeText(value) {
    return window.VotingApp?.escapeHtml ? window.VotingApp.escapeHtml(String(value ?? '')) : String(value ?? '');
}

function getLoginUrl() {
    return `http://${CURRENT_HOST}:3000/Login`;
}

async function loadCandidatesForSearch(forceReload = false) {
    if (hasLoadedCandidates && !forceReload) {
        return {
            term: activeTerm,
            candidates: allCandidates,
            totalVoters: totalVotersCount
        };
    }

    const termsJson = await fetchJsonWithFallback([
        '/api/voter-dashboard/terms',
        '/api/voting/terms'
    ]);

    const selectedTerm = termsJson.data.find(term => Number(term.is_active) === 1) || termsJson.data[0];
    if (!selectedTerm) {
        throw new Error('No election terms available');
    }

    const candidatesJson = await fetchJsonWithFallback([
        `/api/voter-dashboard/candidates?term_id=${selectedTerm.term_id}`,
        `/api/voting/candidates?term_id=${selectedTerm.term_id}`
    ]);

    allCandidates = Array.isArray(candidatesJson.data) ? candidatesJson.data : [];
    totalVotersCount = Number(candidatesJson.total_voters || 0);
    activeTerm = candidatesJson.term || selectedTerm;
    hasLoadedCandidates = true;

    return {
        term: activeTerm,
        candidates: allCandidates,
        totalVoters: totalVotersCount
    };
}

function getCandidateSearchText(candidate) {
    return `${candidate?.name || ''} ${candidate?.display_id || ''} ${candidate?.policies || ''}`.toLowerCase();
}

function hideSuggestions() {
    const box = document.getElementById('searchSuggestions');
    if (!box) return;
    box.classList.add('hidden');
    box.innerHTML = '';
}

function renderSuggestions(query) {
    const box = document.getElementById('searchSuggestions');
    if (!box) return;

    const q = query.toLowerCase().trim();
    if (!q) {
        hideSuggestions();
        return;
    }

    const suggestions = allCandidates
        .filter((candidate) => getCandidateSearchText(candidate).includes(q))
        .slice(0, 6);

    if (!suggestions.length) {
        hideSuggestions();
        return;
    }

    box.innerHTML = suggestions.map((candidate) => {
        const safeName = escapeText(candidate?.name || `Candidate ${candidate?.candidate_id}`);
        const safeId = escapeText(candidate?.display_id || String(candidate?.candidate_id || '-'));
        return `
            <button type="button" class="suggestion-item" data-suggestion-candidate-id="${candidate.candidate_id}">
                <span class="suggestion-name">${safeName}</span>
                <span class="suggestion-meta">${safeId}</span>
            </button>
        `;
    }).join('');

    box.classList.remove('hidden');
}

function renderResults(container, query, candidates, term, totalVoters) {
    const q = query.toLowerCase().trim();

    const filtered = candidates
        .filter(c => {
            const name = (c.name || '').toLowerCase();
            const id = (c.display_id || '').toLowerCase();
            const policies = (c.policies || '').toLowerCase();
            return !q || name.includes(q) || id.includes(q) || policies.includes(q);
        })
        .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));

    latestFilteredCandidates = filtered;

    const termTitle = escapeText(term?.description || term?.name || 'Current Election Term');
    const countText = `${filtered.length} result${filtered.length === 1 ? '' : 's'}`;

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:12px; color:var(--text-muted);">
                <span>${termTitle}</span>
                <span>${countText}</span>
            </div>
            <div class="empty-state">
                <div class="empty-icon">🔍</div>
                <h3 style="color:var(--crimson-dark); margin-bottom:10px;">No candidates found</h3>
                <p>Try searching by candidate name, ID, or policy keywords.</p>
            </div>`;
        return;
    }

    const rows = filtered.map((c, index) => {
        const safeName = escapeText(c.name || `Candidate ${c.candidate_id}`);
        const safeId = escapeText(c.display_id || c.candidate_id || '-');
        const safePolicies = escapeText(c.policies || 'No policy data available');
        const shortPolicies = safePolicies.length > 160 ? `${safePolicies.slice(0, 160)}...` : safePolicies;
        const score = Number(c.score || 0);
        const rate = totalVoters > 0 ? ((score / totalVoters) * 100).toFixed(1) : '0.0';

        return `
            <div class="search-result-item" style="align-items:flex-start; gap:12px;">
                <div style="flex:1; min-width:0;">
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                        <strong>${safeName}</strong>
                        <span style="color:var(--text-muted); font-size:13px;">(${safeId})</span>
                    </div>
                    <div style="margin-top:8px; color:var(--text-muted); font-size:13px; line-height:1.45;">${shortPolicies}</div>
                    <button class="read-policy-btn" data-policy-index="${index}">Read full policy</button>
                </div>
                <div class="result-score" style="text-align:right; min-width:120px;">
                    <div>${score}</div>
                    <div style="font-family:var(--font-body); font-size:12px; color:var(--text-muted);">Votes (${rate}%)</div>
                </div>
            </div>`;
    }).join('');

    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; margin-bottom:12px; color:var(--text-muted); font-size:13px;">
            <span>${termTitle}</span>
            <span>${countText}</span>
        </div>
        ${rows}`;
}

function openPolicyModal(candidate) {
    const modal = document.getElementById('policyModal');
    const nameEl = document.getElementById('policyCandidateName');
    const idEl = document.getElementById('policyCandidateId');
    const contentEl = document.getElementById('policyModalContent');

    if (!modal || !nameEl || !idEl || !contentEl) return;

    nameEl.textContent = candidate?.name || `Candidate ${candidate?.candidate_id || '-'}`;
    idEl.textContent = candidate?.display_id || String(candidate?.candidate_id || '-');
    contentEl.textContent = candidate?.policies || 'No policy data available.';

    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function closePolicyModal() {
    const modal = document.getElementById('policyModal');
    if (!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

async function performSearch() {
    const searchInput = document.getElementById('searchInput');
    const container = document.getElementById('searchResultsContainer');
    if (!searchInput || !container) return;

    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">🔍</div>
            <h3 style="color:var(--crimson-dark); margin-bottom:10px;">Searching...</h3>
            <p>Please wait...</p>
        </div>`;

    try {
        const { term, candidates, totalVoters } = await loadCandidatesForSearch();
        renderResults(container, searchInput.value, candidates, term, totalVoters);
    } catch (error) {
        console.error('Search error:', error);
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">❌</div>
                <h3 style="color:var(--crimson-dark); margin-bottom:10px;">Search Error</h3>
                <p>${escapeText(error.message || 'Unable to perform search. Please try again later.')}</p>
            </div>`;
    }
}

function handleLogout() {
    sessionStorage.removeItem('user');
    window.location.href = getLoginUrl();
}

document.addEventListener('DOMContentLoaded', function() {
    const logoutButton = document.querySelector('.logout-btn');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }

    const searchInput = document.getElementById('searchInput');
    const resultsContainer = document.getElementById('searchResultsContainer');
    const suggestionsBox = document.getElementById('searchSuggestions');
    const policyCloseBtn = document.getElementById('policyModalClose');
    const policyModal = document.getElementById('policyModal');

    if (resultsContainer) {
        resultsContainer.addEventListener('click', (event) => {
            const btn = event.target.closest('.read-policy-btn');
            if (!btn) return;

            const index = Number(btn.getAttribute('data-policy-index'));
            const candidate = latestFilteredCandidates[index];
            if (candidate) {
                openPolicyModal(candidate);
            }
        });
    }

    if (policyCloseBtn) {
        policyCloseBtn.addEventListener('click', closePolicyModal);
    }

    if (policyModal) {
        policyModal.addEventListener('click', (event) => {
            const shouldClose = event.target.closest('[data-close-policy-modal="true"]');
            if (shouldClose) {
                closePolicyModal();
            }
        });
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closePolicyModal();
        }
    });

    if (searchInput) {
        let timer;
        searchInput.addEventListener('input', () => {
            clearTimeout(timer);
            renderSuggestions(searchInput.value);
            timer = setTimeout(() => performSearch(), 180);
        });

        searchInput.addEventListener('focus', () => {
            renderSuggestions(searchInput.value);
        });

        searchInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                hideSuggestions();
                performSearch();
            }
        });

        document.addEventListener('click', (event) => {
            if (!event.target.closest('.search-box-wrap')) {
                hideSuggestions();
            }
        });

        if (suggestionsBox) {
            suggestionsBox.addEventListener('click', (event) => {
                const btn = event.target.closest('[data-suggestion-candidate-id]');
                if (!btn) return;

                const candidateId = Number(btn.getAttribute('data-suggestion-candidate-id'));
                const candidate = allCandidates.find((item) => Number(item.candidate_id) === candidateId);
                if (!candidate) return;

                searchInput.value = candidate.name || candidate.display_id || '';
                hideSuggestions();
                performSearch();
            });
        }

        loadCandidatesForSearch()
            .then(() => {
                renderSuggestions(searchInput.value);
                performSearch();
            })
            .catch((error) => {
                console.error('Initial search preload error:', error);
                performSearch();
            });
    }
});