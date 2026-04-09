// script.js
// โครงสร้างข้อมูลสำหรับ 1 ผู้ใช้งาน (Single User)
let appData = {
    voters: 5000,
    user: {
        name: "John Doe",
        id: "6431201011",
        faculty: "Information Technology",
        hasVoted: false,
        history: [],
        avatarUrl: "" // เอาไว้เก็บรูปภาพ Base64 ที่อัปโหลด
    },
    candidates: [
        { id: 1, initials: 'A', name: 'Alice Smith', party: 'Student Action', votes: 450, policy: 'Improve campus Wi-Fi. More study spaces.' },
        { id: 2, initials: 'B', name: 'Bob Jones', party: 'Campus Voice', votes: 320, policy: 'Better cafeteria food. Extension of library hours.' },
        { id: 3, initials: 'C', name: 'Charlie Brown', party: 'Future Leaders', votes: 150, policy: 'More funding for clubs. Greener campus initiatives.' }
    ]
};

function initApp() {
    // โหลดข้อมูลเก่า (ถ้ามี)
    const savedData = localStorage.getItem('mfuVoting_SingleUser');
    if (savedData) appData = JSON.parse(savedData);

    refreshAllUI();
}

function saveData() {
    localStorage.setItem('mfuVoting_SingleUser', JSON.stringify(appData));
}

// ==========================================
// ระบบอัปโหลดรูปภาพโปรไฟล์ (Image Upload)
// ==========================================
function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (file) {
        // จำกัดขนาดคร่าวๆ (ออปชันเสริม)
        if (file.size > 2 * 1024 * 1024) {
            alert("ไฟล์ใหญ่เกินไป กรุณาเลือกรูปขนาดไม่เกิน 2MB");
            return;
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            // บันทึกรูปเป็น Base64
            appData.user.avatarUrl = e.target.result;
            saveData();
            updateProfileAvatarUI(); // อัปเดต UI
        };
        reader.readAsDataURL(file);
    }
}

function updateProfileAvatarUI() {
    const avatarDisplay = document.getElementById('profileAvatarDisplay');
    if (appData.user.avatarUrl) {
        // แทรกรูปภาพเข้าไปแทนที่อีโมจิ 👤
        avatarDisplay.innerHTML = `<img src="${appData.user.avatarUrl}" alt="Profile Avatar" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
    } else {
        avatarDisplay.innerHTML = '👤';
    }
}

// ==========================================
// ระบบ UI ทั่วไป
// ==========================================
function refreshAllUI() {
    updateProfileUI();
    updateProfileAvatarUI();
    updateDashboard();
    renderPolicies();
    renderVotingSection();
    renderHistory();
}

function switchTab(tabId, element) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');

    if (element && element.classList.contains('menu-item')) element.classList.add('active');

    const titles = {
        'profile': 'My Profile',
        'dashboard': 'Dashboard Overview',
        'candidates': 'Candidates & Policies',
        'vote': 'Cast Your Vote',
        'history': 'Voting History',
        'search': 'Search Results'
    };
    document.getElementById('pageTitle').innerText = titles[tabId];

    // ทันทีที่เปิดหน้า Search ให้แสดงรายชื่อทั้งหมดก่อน
    if (tabId === 'search') {
        performSearch();
    }
}

function updateProfileUI() {
    document.getElementById('profName').innerText = appData.user.name;
    document.getElementById('profId').innerText = `ID: ${appData.user.id}`;
    document.getElementById('profFaculty').innerText = `Faculty: ${appData.user.faculty}`;
    document.getElementById('sidebarVoterId').innerText = `ID: ${appData.user.id}`;

    const statusText = appData.user.hasVoted ? "✓ Voted" : "Ready to Vote";
    document.getElementById('sidebarStatus').innerText = statusText;
    document.getElementById('sidebarStatus').style.color = appData.user.hasVoted ? "#4CAF50" : "var(--gold-bright)";

    const badge = document.getElementById('profStatusBadge');
    if (appData.user.hasVoted) {
        badge.innerText = "Status: Voted Successfully";
        badge.className = "profile-status-badge status-voted";
    } else {
        badge.innerText = "Status: Ready to Vote";
        badge.className = "profile-status-badge status-ready";
    }
}

function updateDashboard() {
    let totalV = appData.candidates.reduce((sum, c) => sum + c.votes, 0);
    document.getElementById('totalVoters').innerText = appData.voters.toLocaleString();
    document.getElementById('totalCandidates').innerText = appData.candidates.length;
    document.getElementById('totalVotes').innerText = totalV.toLocaleString();
    document.getElementById('votingPercent').innerText = ((totalV / appData.voters) * 100).toFixed(1) + "%";
}

function renderPolicies() {
    const html = appData.candidates.map(c => `
        <div class="candidate-card">
            <div class="candidate-avatar">${c.initials}</div>
            <div class="candidate-name">${c.name}</div>
            <div class="candidate-party">${c.party}</div>
            <button class="policy-btn" onclick="viewPolicy(${c.id})">Read Policy</button>
        </div>
    `).join('');
    document.getElementById('candidatesGridPolicies').innerHTML = html;
}

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

function renderHistory() {
    const container = document.getElementById('historyContainer');
    if (appData.user.history.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">📜</div>No voting history found.</div>`;
        return;
    }

    let rows = appData.user.history.map(h => `
        <div class="table-row">
            <div><strong>${h.candidate}</strong><br><span style="color:var(--text-muted); font-size:12px;">${h.party}</span></div>
            <div>1 Vote</div>
            <div class="timestamp-cell">${h.time}</div>
        </div>
    `).join('');

    container.innerHTML = `<div class="history-table">
        <div class="table-header"><div>Candidate</div><div>Action</div><div>Timestamp</div></div>
        ${rows}</div>`;
}

function viewPolicy(id) {
    let c = appData.candidates.find(x => x.id === id);
    document.getElementById('policyTitle').innerText = c.name + "'s Policy";
    document.getElementById('policyContent').innerText = c.policy;
    document.getElementById('policyModal').classList.add('active');
}

let selectedCandidate = null;
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

// ==========================================
// ระบบค้นหา (Real-time Search)
// ==========================================
function performSearch() {
    let q = document.getElementById('searchInput').value.toLowerCase();

    // ค้นหาทั้งจากชื่อและชื่อพรรค (กรองทันทีที่พิมพ์)
    let res = appData.candidates.filter(c =>
        c.name.toLowerCase().includes(q) || c.party.toLowerCase().includes(q)
    );

    let html = res.map(c => `
        <div class="search-result-item">
            <div>
                <strong>${c.name}</strong> 
                <span style="color:var(--text-muted); font-size:13px; margin-left:8px;">(${c.party})</span>
            </div>
            <div class="result-score">${c.votes} Votes</div>
        </div>
    `).join('');

    // ถ้าไม่เจอใครเลยให้แสดงข้อความนี้
    if (!html) {
        html = `
        <div class="empty-state">
            <div class="empty-icon">🔍</div>
            <p>No results found for "${q}"</p>
        </div>`;
    }

    document.getElementById('searchResultsContainer').innerHTML = html;
}

function closeModal(id) { document.getElementById(id).classList.remove('active'); }
function logout() { alert("Logged out successfully."); }

window.onload = initApp;