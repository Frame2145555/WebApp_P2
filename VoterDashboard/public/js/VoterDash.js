
// เก็บข้อมูลจาก Database
let state = {
    user: null,         // ข้อมูล Voter ที่ล็อกอินเข้ามา
    candidates: [],     // รายชื่อผู้สมัครจาก Database
    hasVoted: false,    // สถานะการโหวต
    chartInstance: null // เก็บตัวแปรกราฟ
};

// 🚀 Initialization (ตอนโหลดหน้าเว็บ)
async function initApp() {
    // เปลี่ยนจาก localStorage เป็น sessionStorage
    const userData = sessionStorage.getItem('user');
    if (!userData) {
        alert("Please sign in first.");
        window.location.replace('/public/Login.html');
        return;
    }
    state.user = JSON.parse(userData);

    // เปลี่ยนการเช็คสถานะการโหวต
    state.hasVoted = sessionStorage.getItem(`voted_${state.user.user_id}`) === 'true';

    await fetchCandidates();
    refreshAllUI();

    setInterval(async () => {
        await fetchCandidates();
        updateDashboard();
        renderChart();
        renderRankingTable();
    }, 10000);
}

// 🚀 API Calls (เชื่อมต่อ Backend)
async function fetchCandidates() {
    try {
        const userId = state.user?.user_id;
        const url = userId ? `/api/voter-dashboard/candidates?user_id=${encodeURIComponent(userId)}` : '/api/voter-dashboard/candidates';
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.status === 'success') {
            state.candidates = result.data;
            state.totalVoters = result.total_voters || 0; // 🚨 เก็บค่าจาก DB ไว้ใน state
        } else {
            console.warn('Failed to fetch candidates:', result.message);
            state.candidates = [];
            state.totalVoters = 0;
        }
    } catch (error) {
        console.error("Error fetching candidates:", error);
        state.candidates = [];
        state.totalVoters = 0;
    }
}

// 🚀 UI Renders
function refreshAllUI() {
    updateProfileUI();
    updateDashboard();
    renderPolicies();
    renderVotingSection();
    renderChart();
    renderRankingTable();
}

function updateProfileUI() {
    document.getElementById('profName').innerText = state.user.display_name || state.user.username;
    document.getElementById('profId').innerText = `ID: ${state.user.username}`;
    document.getElementById('sidebarVoterId').innerText = `ID: ${state.user.username}`;

    const statusText = state.hasVoted ? "✓ Voted" : "Ready to Vote";
    document.getElementById('sidebarStatus').innerText = statusText;
    document.getElementById('sidebarStatus').style.color = state.hasVoted ? "#4CAF50" : "var(--gold-bright)";

    const badge = document.getElementById('profStatusBadge');
    if (state.hasVoted) {
        badge.innerText = "Status: Voted Successfully";
        badge.className = "profile-status-badge status-voted";
    } else {
        badge.innerText = "Status: Ready to Vote";
        badge.className = "profile-status-badge status-ready";
    }
}

function updateDashboard() {
    let totalV = state.candidates.reduce((sum, c) => sum + (c.score || 0), 0);
    
    document.getElementById('totalCandidates').innerText = state.candidates.length;
    document.getElementById('totalVotes').innerText = totalV.toLocaleString();
    
    // ใช้ตัวเลขจริงจาก Database
    const realTotalVoters = state.totalVoters || 0; 
    document.getElementById('totalVoters').innerText = realTotalVoters.toLocaleString();
    
    // คำนวณเปอร์เซ็นต์แบบไม่ให้หารศูนย์ (NaN)
    const percent = realTotalVoters > 0 ? ((totalV / realTotalVoters) * 100).toFixed(1) : 0;
    document.getElementById('votingPercent').innerText = percent + "%";
}

// ฟังก์ชันวาดกราฟ Top 3
function renderChart() {
    const ctx = document.getElementById('topCandidatesChart').getContext('2d');
    
    const top3 = [...state.candidates]
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

    const labels = top3.map(c => c.name);
    const data = top3.map(c => c.score);
    const colors = ['#8C1515', '#D4AF37', '#4a4a4a']; 

    if (state.chartInstance) {
        state.chartInstance.destroy();
    }

    state.chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderRadius: 5,
                maxBarThickness: 40
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: { beginAtZero: true },
                y: { grid: { display: false } }
            }
        }
    });
}

function renderRankingTable() {
    const container = document.getElementById('dashboardRankingTable');
    if (!container) return;

    if (!state.candidates.length) {
        container.innerHTML = `<div class="ranking-empty">No candidate results yet.</div>`;
        return;
    }

    const sortedCandidates = [...state.candidates].sort((a, b) => {
        const scoreB = Number(b.score) || 0;
        const scoreA = Number(a.score) || 0;
        if (scoreB !== scoreA) return scoreB - scoreA;

        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
    });

    const rows = sortedCandidates.map((candidate, index) => {
        const rank = index + 1;
        const rankClass = rank <= 3 ? `rank-${rank}` : '';
        const displayName = candidate.name || `Candidate #${candidate.candidate_id}`;
        const displayId = candidate.display_id || `CID-${candidate.candidate_id}`;
        const score = Number(candidate.score) || 0;

        return `
            <div class="ranking-row">
                <div><span class="rank-chip ${rankClass}">${rank}</span></div>
                <div>
                    <div class="ranking-name">${displayName}</div>
                    <div class="ranking-id">${displayId}</div>
                </div>
                <div class="ranking-votes">${score}</div>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div class="ranking-table-head">
            <div>Rank</div>
            <div>Candidate</div>
            <div style="text-align:right;">Votes</div>
        </div>
        ${rows}
    `;
}

function renderPolicies() {
    const html = state.candidates.map(c => `
        <div class="candidate-card">
            <div class="candidate-avatar">
                ${c.profile_picture ? `<img src="${c.profile_picture}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : '👤'}
            </div>
            <div class="candidate-name">${c.name}</div>
            <div class="candidate-party">Candidate</div> <button class="policy-btn" onclick="viewPolicy(${c.candidate_id})">Read Policy</button>
        </div>
    `).join('');
    document.getElementById('candidatesGridPolicies').innerHTML = html || '<p>No candidates available yet.</p>';
}

function renderVotingSection() {
    const container = document.getElementById('voteContainer');
    if (state.hasVoted) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon" style="color:#4CAF50">✅</div>
                <h3 style="color:#8C1515; margin-bottom:10px;">You have already voted!</h3>
                <p>Your vote has already been submitted. Duplicate voting is not allowed.</p>
            </div>`;
        return;
    }

    container.innerHTML = `
        <div class="alert-box" style="margin-bottom: 24px;">
            <strong>Note:</strong> You can vote only once. Please double-check before confirming.
        </div>
        <div class="candidates-grid">
            ${state.candidates.map(c => `
                <div class="candidate-card">
                    <div class="candidate-avatar">
                        ${c.profile_picture ? `<img src="${c.profile_picture}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : '👤'}
                    </div>
                    <div class="candidate-name">${c.name}</div>
                    <div class="candidate-party">${c.display_id}</div>
                    <div class="candidate-actions">
                        <button class="vote-btn" onclick="confirmVote(${c.candidate_id})">VOTE</button>
                    </div>
                </div>
            `).join('')}
        </div>`;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function getCandidateParty(candidate) {
    return candidate.party ||
        candidate.party_name ||
        candidate.partyName ||
        candidate.group_name ||
        candidate.display_id ||
        '';
}

function performSearch() {
    const input = document.getElementById('searchInput');
    const container = document.getElementById('searchResultsContainer');
    if (!input || !container) return;

    const query = String(input.value || '').toLowerCase().trim();

    const filtered = state.candidates.filter(candidate => {
        const name = String(candidate.name || '').toLowerCase();
        const party = String(getCandidateParty(candidate) || '').toLowerCase();
        return name.includes(query) || party.includes(query);
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔍</div>
                <p>No results found for "${escapeHtml(input.value.trim())}"</p>
            </div>`;
        return;
    }

    container.innerHTML = filtered.map(candidate => {
        const name = candidate.name || `Candidate #${candidate.candidate_id}`;
        const party = getCandidateParty(candidate);
        return `
            <div class="search-result-item">
                <div>
                    <strong>${escapeHtml(name)}</strong>
                    <span style="color:var(--text-muted); font-size:13px; margin-left:8px;">(${escapeHtml(candidate.display_id || candidate.candidate_id)})</span>
                    ${party ? `<br><span style="color:var(--text-muted); font-size:12px;">Party: ${escapeHtml(party)}</span>` : ''}
                </div>
                <div class="result-score">${Number(candidate.score) || 0} Votes</div>
            </div>`;
    }).join('');
}

window.performSearch = performSearch;

// 🚀 ระบบจัดการการโหวต (Voting Process)
let selectedCandidate = null;

function viewPolicy(id) {
    let c = state.candidates.find(x => x.candidate_id === id);
    document.getElementById('policyTitle').innerText = `${c.name}'s Policy`;
    document.getElementById('policyContent').innerText = c.policies || 'No policy provided yet.';
    document.getElementById('policyModal').classList.add('active');
}

function confirmVote(id) {
    if (state.hasVoted) return alert("You have already voted!");
    selectedCandidate = state.candidates.find(x => x.candidate_id === id);
    document.getElementById('confirmName').innerText = selectedCandidate.name;
    document.getElementById('confirmParty').innerText = 'Please verify the candidate name before confirming.';
    document.getElementById('confirmVoteModal').classList.add('active');
}

// 🚨 ฟังก์ชันยิงคะแนนเข้า Database ของจริง!
async function processVote() {
    // ปิดหน้าต่างยืนยันก่อน
    closeModal('confirmVoteModal');

    try {
        const response = await fetch('/api/voter-dashboard/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: state.user.user_id,
                candidate_id: selectedCandidate.candidate_id
            })
        });

        const result = await response.json();

        if (result.status === 'success') {
            // สำเร็จ! ล็อคสถานะการโหวต
            state.hasVoted = true;
            // เปลี่ยนมาเก็บใน sessionStorage
            sessionStorage.setItem(`voted_${state.user.user_id}`, 'true');

            await fetchCandidates();
            refreshAllUI();

            // โชว์หน้าต่าง Success
            document.getElementById('successCandidate').innerText = selectedCandidate.name;
            document.getElementById('successTime').innerText = new Date().toLocaleString('en-US');
            document.getElementById('successModal').classList.add('active');

        } else {
            // โดนหลังบ้านเตะกลับมา (เช่น โหวตไปแล้ว, โดนแบน)
            alert(`Unable to submit vote: ${result.message}`);
        }
    } catch (error) {
        console.error("Voting Error:", error);
        alert("A server connection error occurred.");
    }
}

// ฟังก์ชันอื่นๆ (Tabs, Close Modal)
function finishVotingFlow() { closeModal('successModal'); switchTab('dashboard', document.querySelectorAll('.menu-item')[1]); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
function logout() {
    sessionStorage.removeItem('user'); // ลบออกจาก sessionStorage
    window.location.replace('/public/Login.html');
}
function switchTab(tabId, element) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    if (element && element.classList.contains('menu-item')) element.classList.add('active');
        if (tabId === 'search') performSearch();
        if (tabId === 'history') {
            renderHistory();
        }
    if (tabId === 'history') {
        renderHistory();
    }
}

async function renderHistory() {
    const container = document.getElementById('historyContainer');
    if (!container) return;

    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">⏳</div>
            <h3 style="color:var(--crimson-dark); margin-bottom:10px;">Loading History</h3>
            <p>Please wait...</p>
        </div>`;

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

    try {
        const userIdentifier = user.user_id || user.username;
        const response = await fetch(`/api/voter-dashboard/history/${encodeURIComponent(userIdentifier)}`);
        const result = await response.json();

        if (result.status === 'success') {
            const history = result.data;
            if (history.length === 0) {
                container.innerHTML = `<div class="empty-state"><div class="empty-icon">📜</div>No voting history found.</div>`;
                return;
            }

            const rows = history.map(h => `
                <div class="table-row">
                    <div><strong>${h.candidate}</strong><br><span style="color:var(--text-muted); font-size:12px;">${h.party}</span></div>
                    <div>1 Vote</div>
                    <div class="timestamp-cell">${h.time}</div>
                </div>
            `).join('');

            container.innerHTML = `<div class="history-table">
                <div class="table-header"><div>Candidate</div><div>Action</div><div>Timestamp</div></div>
                ${rows}
            </div>`;
        } else {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">❌</div>
                    <h3 style="color:var(--crimson-dark); margin-bottom:10px;">Error Loading History</h3>
                    <p>${result.message || 'Failed to load voting history'}</p>
                </div>`;
        }
    } catch (error) {
        console.error('History loading error:', error);
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">❌</div>
                <h3 style="color:var(--crimson-dark); margin-bottom:10px;">Connection Error</h3>
                <p>Unable to load voting history. Please try again later.</p>
            </div>`;
    }
}

window.onload = initApp;